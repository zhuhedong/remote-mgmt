package main

import (
	"bufio"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/hashicorp/yamux"
)

const protoTag = "dra-v1"

// Agent is one connected, authenticated device.
type Agent struct {
	DeviceID string
	sess     *yamux.Session
	ctrl     net.Conn
	wmu      sync.Mutex
	pending  sync.Map // id -> chan map[string]any
	seq      atomic.Int64
	Status   atomic.Value // map[string]any
	Since    time.Time
}

func (a *Agent) send(m map[string]any) error {
	b, _ := json.Marshal(m)
	a.wmu.Lock()
	defer a.wmu.Unlock()
	a.ctrl.SetWriteDeadline(time.Now().Add(10 * time.Second))
	_, err := a.ctrl.Write(append(b, '\n'))
	return err
}

// Call sends a request on the control stream and waits for the matching reply.
func (a *Agent) Call(ctx context.Context, typ string, body map[string]any) (map[string]any, error) {
	id := fmt.Sprint(a.seq.Add(1))
	ch := make(chan map[string]any, 1)
	a.pending.Store(id, ch)
	defer a.pending.Delete(id)
	body["type"] = typ
	body["id"] = id
	if err := a.send(body); err != nil {
		return nil, err
	}
	select {
	case r := <-ch:
		if e, _ := r["error"].(string); e != "" {
			return nil, errors.New(e)
		}
		return r, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-a.sess.CloseChan():
		return nil, errors.New("device disconnected")
	}
}

// OpenService opens a new stream to a named local service on the device.
func (a *Agent) OpenService(svc string) (net.Conn, error) {
	st, err := a.sess.OpenStream()
	if err != nil {
		return nil, err
	}
	pre, _ := json.Marshal(map[string]string{"svc": svc})
	if _, err := st.Write(append(pre, '\n')); err != nil {
		st.Close()
		return nil, err
	}
	return st, nil
}

type Registry struct {
	mu sync.Mutex
	m  map[string]*Agent
}

func (r *Registry) Get(id string) *Agent { r.mu.Lock(); defer r.mu.Unlock(); return r.m[id] }
func (r *Registry) put(a *Agent) *Agent {
	r.mu.Lock()
	defer r.mu.Unlock()
	old := r.m[a.DeviceID]
	r.m[a.DeviceID] = a
	return old
}
func (r *Registry) drop(a *Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.m[a.DeviceID] == a {
		delete(r.m, a.DeviceID)
	}
}
func (r *Registry) Kick(id string) {
	if a := r.Get(id); a != nil {
		a.send(map[string]any{"type": "revoked"})
		time.Sleep(50 * time.Millisecond)
		a.sess.Close()
	}
}

func (h *Hub) handleAgentConnect(w http.ResponseWriter, r *http.Request) {
	ip := h.clientIP(r)
	if h.lim.Locked("agent:" + ip) {
		http.Error(w, "locked", 429)
		return
	}
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{})
	if err != nil {
		return
	}
	c.SetReadLimit(-1)
	ctx := context.Background()
	nc := websocket.NetConn(ctx, c, websocket.MessageBinary)
	cfg := yamux.DefaultConfig()
	cfg.KeepAliveInterval = 20 * time.Second
	cfg.ConnectionWriteTimeout = 45 * time.Second
	cfg.MaxStreamWindowSize = 256 * 1024
	cfg.LogOutput = io.Discard
	sess, err := yamux.Server(nc, cfg)
	if err != nil {
		nc.Close()
		return
	}
	// The agent opens stream 1 as the control channel.
	authTimer := time.AfterFunc(15*time.Second, func() { sess.Close() })
	ctrl, err := sess.AcceptStream()
	if err != nil {
		sess.Close()
		return
	}
	ctrl.SetDeadline(time.Now().Add(15 * time.Second))
	rd := bufio.NewReaderSize(ctrl, 64*1024)
	var hello struct{ Type, DeviceID string; Versions map[string]string }
	if err := readJSON(rd, &hello); err != nil || hello.Type != "hello" {
		sess.Close()
		return
	}
	nonce := base64.StdEncoding.EncodeToString(randBytes(32))
	ts := time.Now().Unix()
	writeJSON(ctrl, map[string]any{"type": "challenge", "nonce": nonce, "ts": ts})
	var auth struct{ Type, Sig string }
	if err := readJSON(rd, &auth); err != nil || auth.Type != "auth" {
		sess.Close()
		return
	}
	var pub, status, slug string
	err = h.st.db.QueryRow(`SELECT pubkey,status,slug FROM devices WHERE id=?`, hello.DeviceID).Scan(&pub, &status, &slug)
	pk, _ := base64.StdEncoding.DecodeString(pub)
	sig, _ := base64.StdEncoding.DecodeString(auth.Sig)
	msg := []byte(fmt.Sprintf("%s|%d|%s|%s", nonce, ts, hello.DeviceID, protoTag))
	if err != nil || len(pk) != ed25519.PublicKeySize || !ed25519.Verify(pk, msg, sig) {
		h.lim.Fail("agent:" + ip)
		writeJSON(ctrl, map[string]any{"type": "denied", "reason": "unknown device or bad signature"})
		time.Sleep(50 * time.Millisecond)
		sess.Close()
		return
	}
	if status != "active" {
		writeJSON(ctrl, map[string]any{"type": "denied", "reason": status})
		time.Sleep(50 * time.Millisecond)
		sess.Close()
		return
	}
	authTimer.Stop()
	ctrl.SetDeadline(time.Time{})
	a := &Agent{DeviceID: hello.DeviceID, sess: sess, ctrl: ctrl, Since: time.Now()}
	a.Status.Store(map[string]any{})
	if old := h.reg.put(a); old != nil {
		old.sess.Close()
	}
	vb, _ := json.Marshal(hello.Versions)
	h.st.db.Exec(`UPDATE devices SET last_seen=?, versions=? WHERE id=?`, time.Now().Unix(), string(vb), a.DeviceID)
	h.st.Audit("", ip, "device.connect", a.DeviceID, "ok")
	writeJSON(ctrl, map[string]any{"type": "welcome", "slug": slug, "hosts": []string{h.serviceHost("dsh", slug)}})
	log.Printf("device %s connected", a.DeviceID)

	go func() {
		<-sess.CloseChan()
		h.reg.drop(a)
		h.st.db.Exec(`UPDATE devices SET last_seen=? WHERE id=?`, time.Now().Unix(), a.DeviceID)
		h.st.Audit("", ip, "device.disconnect", a.DeviceID, "")
		log.Printf("device %s disconnected", a.DeviceID)
	}()
	// Reject unexpected agent-initiated streams.
	go func() {
		for {
			s, err := sess.AcceptStream()
			if err != nil {
				return
			}
			s.Close()
		}
	}()
	for {
		line, err := rd.ReadBytes('\n')
		if err != nil {
			sess.Close()
			return
		}
		var m map[string]any
		if json.Unmarshal(line, &m) != nil {
			continue
		}
		switch m["type"] {
		case "status":
			a.Status.Store(m)
			h.st.db.Exec(`UPDATE devices SET last_seen=? WHERE id=?`, time.Now().Unix(), a.DeviceID)
		case "reply":
			if id, _ := m["id"].(string); id != "" {
				if ch, ok := a.pending.Load(id); ok {
					ch.(chan map[string]any) <- m
				}
			}
		}
	}
}

func readJSON(r *bufio.Reader, v any) error {
	line, err := r.ReadBytes('\n')
	if err != nil {
		return err
	}
	return json.Unmarshal(line, v)
}
func writeJSON(w io.Writer, v any) {
	b, _ := json.Marshal(v)
	w.Write(append(b, '\n'))
}
