package main

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hashicorp/yamux"
)

func testHubWithSession(t *testing.T) (*Hub, string) {
	t.Helper()
	st, err := OpenStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := &Hub{
		cfg: Config{BaseHost: "remote.x.cn", Zone: "d.remote.x.cn", Insecure: true},
		st:  st,
		reg: &Registry{m: map[string]*Agent{}},
		lim: NewLimiter(),
	}
	_, err = st.db.Exec(`INSERT INTO users(username,pwhash,totp_enc,role,created) VALUES(?,?,?,?,?)`,
		"owner", hashPassword("correct horse battery"), st.seal([]byte("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")), "owner", time.Now().Unix())
	if err != nil {
		t.Fatal(err)
	}
	var uid int64
	st.db.QueryRow(`SELECT id FROM users WHERE username=?`, "owner").Scan(&uid)
	tok := randToken()
	sid := "sess1"
	now := time.Now()
	st.db.Exec(`INSERT INTO sessions(id,hash,user_id,created,last_seen,expires,ip,ua) VALUES(?,?,?,?,?,?,?,?)`,
		sid, hashTok(tok), uid, now.Unix(), now.Unix(), now.Add(time.Hour).Unix(), "127.0.0.1", "test")
	st.db.Exec(`INSERT INTO devices(id,name,slug,pubkey,status,created) VALUES(?,?,?,?,?,?)`,
		"dev1", "Mac", "mac", "dGVzdA==", "active", now.Unix())
	return h, tok
}

func startFakeCapAgent(t *testing.T, h *Hub, deviceID string, onMsg func(m map[string]any) map[string]any) (cleanup func()) {
	t.Helper()
	c1, c2 := net.Pipe()
	cfg := yamux.DefaultConfig()
	cfg.EnableKeepAlive = false
	cfg.LogOutput = io.Discard
	srv, err := yamux.Server(c1, cfg)
	if err != nil {
		t.Fatal(err)
	}
	cli, err := yamux.Client(c2, cfg)
	if err != nil {
		t.Fatal(err)
	}
	agentCtrl, err := cli.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	hubCtrl, err := srv.AcceptStream()
	if err != nil {
		t.Fatal(err)
	}
	a := &Agent{DeviceID: deviceID, sess: srv, ctrl: hubCtrl, Since: time.Now()}
	a.Status.Store(map[string]any{})
	h.reg.put(a)

	// deliver replies into Agent.pending (mirrors handleAgentConnect)
	go func() {
		rd := bufio.NewReader(hubCtrl)
		for {
			line, err := rd.ReadBytes('\n')
			if err != nil {
				return
			}
			var m map[string]any
			if json.Unmarshal(line, &m) != nil {
				continue
			}
			if m["type"] == "reply" {
				if id, _ := m["id"].(string); id != "" {
					if ch, ok := a.pending.Load(id); ok {
						ch.(chan map[string]any) <- m
					}
				}
			}
		}
	}()

	// fake agent side: read requests, write replies
	go func() {
		rd := bufio.NewReader(agentCtrl)
		for {
			line, err := rd.ReadBytes('\n')
			if err != nil {
				return
			}
			var m map[string]any
			if json.Unmarshal(line, &m) != nil {
				continue
			}
			id, _ := m["id"].(string)
			body := onMsg(m)
			if body == nil {
				body = map[string]any{"error": "unsupported"}
			}
			body["type"] = "reply"
			body["id"] = id
			b, _ := json.Marshal(body)
			agentCtrl.SetWriteDeadline(time.Now().Add(5 * time.Second))
			agentCtrl.Write(append(b, '\n'))
		}
	}()

	return func() {
		srv.Close()
		cli.Close()
		c1.Close()
		c2.Close()
	}
}

func TestCapabilityOffline(t *testing.T) {
	h, tok := testHubWithSession(t)
	req := httptest.NewRequest("GET", "http://remote.x.cn/api/instances/dev1/capabilities", nil)
	req.AddCookie(&http.Cookie{Name: h.cookieName("sid"), Value: tok})
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 503 {
		t.Fatalf("want 503 got %d %s", rr.Code, rr.Body.String())
	}
}

func TestCapabilityListAndInvokeStatus(t *testing.T) {
	h, tok := testHubWithSession(t)
	cleanup := startFakeCapAgent(t, h, "dev1", func(m map[string]any) map[string]any {
		switch m["type"] {
		case "capability.list":
			return map[string]any{
				"agentCapVersion": 1,
				"capabilities": []map[string]any{{
					"id": "instance.status", "title": "实例状态",
					"params": map[string]any{"type": "object"}, "stream": false,
					"permission": "open", "sensitive": false, "category": "observe",
				}},
			}
		case "capability.invoke":
			if m["capability"] != "instance.status" {
				return map[string]any{"ok": false, "requestId": m["requestId"], "code": "NOT_FOUND", "message": "nope"}
			}
			return map[string]any{
				"ok": true, "requestId": m["requestId"],
				"data": map[string]any{"dshReady": true, "plugin": "0.1.0"},
			}
		default:
			return map[string]any{"error": "unsupported"}
		}
	})
	defer cleanup()

	// list
	req := httptest.NewRequest("GET", "http://remote.x.cn/api/instances/dev1/capabilities", nil)
	req.AddCookie(&http.Cookie{Name: h.cookieName("sid"), Value: tok})
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("list: %d %s", rr.Code, rr.Body.String())
	}
	var listed capListReply
	if err := json.Unmarshal(rr.Body.Bytes(), &listed); err != nil || listed.AgentCapVersion != 1 || len(listed.Capabilities) != 1 {
		t.Fatalf("list body: %s err=%v", rr.Body.String(), err)
	}
	if listed.Capabilities[0].ID != "instance.status" {
		t.Fatal(listed.Capabilities[0].ID)
	}

	// invoke
	body := `{"id":"instance.status","params":{},"requestId":"r1"}`
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.Header.Set("Origin", "http://remote.x.cn")
	req.AddCookie(&http.Cookie{Name: h.cookieName("sid"), Value: tok})
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("invoke: %d %s", rr.Code, rr.Body.String())
	}
	var out map[string]any
	json.Unmarshal(rr.Body.Bytes(), &out)
	if out["ok"] != true || out["requestId"] != "r1" {
		t.Fatalf("%v", out)
	}
	data, _ := out["data"].(map[string]any)
	if data["plugin"] != "0.1.0" {
		t.Fatalf("%v", data)
	}
}

func TestCapabilityUnauthorized(t *testing.T) {
	h, _ := testHubWithSession(t)
	req := httptest.NewRequest("GET", "http://remote.x.cn/api/instances/dev1/capabilities", nil)
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 401 {
		t.Fatalf("want 401 got %d", rr.Code)
	}
}

func TestAgentCallCapabilityListDirect(t *testing.T) {
	// ensure Agent.Call round-trip for capability.list without HTTP
	h, _ := testHubWithSession(t)
	cleanup := startFakeCapAgent(t, h, "dev1", func(m map[string]any) map[string]any {
		if m["type"] == "capability.list" {
			return map[string]any{"agentCapVersion": 1, "capabilities": []any{}}
		}
		return map[string]any{"error": "unsupported"}
	})
	defer cleanup()
	ag := h.reg.Get("dev1")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	res, err := ag.Call(ctx, "capability.list", map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if res["agentCapVersion"].(float64) != 1 {
		t.Fatal(res)
	}
}

func TestSensitiveReauthRequiredThenOK(t *testing.T) {
	h, tok := testHubWithSession(t)
	var forwarded int
	cleanup := startFakeCapAgent(t, h, "dev1", func(m map[string]any) map[string]any {
		if m["type"] == "capability.invoke" {
			forwarded++
			return map[string]any{
				"ok": true, "requestId": m["requestId"],
				"data": map[string]any{"dryRun": true, "executed": false},
			}
		}
		if m["type"] == "capability.list" {
			return map[string]any{"agentCapVersion": 1, "capabilities": []any{}}
		}
		return map[string]any{"error": "unsupported"}
	})
	defer cleanup()

	cookie := &http.Cookie{Name: h.cookieName("sid"), Value: tok}
	body := `{"id":"dsh.restart","params":{},"requestId":"r-sens-1"}`
	req := httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.Header.Set("Origin", "http://remote.x.cn")
	req.AddCookie(cookie)
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 401 {
		t.Fatalf("want 401 REAUTH_REQUIRED got %d %s", rr.Code, rr.Body.String())
	}
	var out map[string]any
	json.Unmarshal(rr.Body.Bytes(), &out)
	if out["code"] != "REAUTH_REQUIRED" {
		t.Fatalf("%v", out)
	}
	if forwarded != 0 {
		t.Fatal("agent must not be called before reauth")
	}

	// wrong password
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/me/reauth", strings.NewReader(`{"password":"wrong"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 401 {
		t.Fatalf("bad reauth: %d", rr.Code)
	}

	// password reauth OK
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/me/reauth", strings.NewReader(`{"password":"correct horse battery"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("reauth: %d %s", rr.Code, rr.Body.String())
	}

	// sensitive invoke now forwards
	body = `{"id":"dsh.restart","params":{},"requestId":"r-sens-2"}`
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.Header.Set("Origin", "http://remote.x.cn")
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("invoke after reauth: %d %s", rr.Code, rr.Body.String())
	}
	if forwarded != 1 {
		t.Fatalf("forwarded=%d", forwarded)
	}

	// audit should mention reauth + invoke
	var n int
	h.st.db.QueryRow(`SELECT COUNT(*) FROM audit WHERE action='reauth' AND result LIKE 'ok:%'`).Scan(&n)
	if n < 1 {
		t.Fatal("missing reauth audit")
	}
	h.st.db.QueryRow(`SELECT COUNT(*) FROM audit WHERE action='capability.invoke' AND result='reauth_required'`).Scan(&n)
	if n < 1 {
		t.Fatal("missing reauth_required audit")
	}
}

func TestReauthTOTP(t *testing.T) {
	h, tok := testHubWithSession(t)
	cookie := &http.Cookie{Name: h.cookieName("sid"), Value: tok}
	code := totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", time.Now())
	req := httptest.NewRequest("POST", "http://remote.x.cn/api/me/reauth", strings.NewReader(`{"code":"`+code+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(cookie)
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("totp reauth: %d %s", rr.Code, rr.Body.String())
	}
	if !h.reauthFresh("sess1", time.Now()) {
		t.Fatal("reauth_at not set")
	}
}

func TestInstancesAlias(t *testing.T) {
	h, tok := testHubWithSession(t)
	req := httptest.NewRequest("GET", "http://remote.x.cn/api/instances", nil)
	req.AddCookie(&http.Cookie{Name: h.cookieName("sid"), Value: tok})
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
}

func TestNonSensitiveSkipsReauth(t *testing.T) {
	h, tok := testHubWithSession(t)
	cleanup := startFakeCapAgent(t, h, "dev1", func(m map[string]any) map[string]any {
		if m["type"] == "capability.invoke" {
			return map[string]any{"ok": true, "requestId": m["requestId"], "data": map[string]any{"dshReady": true}}
		}
		return map[string]any{"error": "unsupported"}
	})
	defer cleanup()
	body := `{"id":"instance.status","params":{},"requestId":"ns1"}`
	req := httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(&http.Cookie{Name: h.cookieName("sid"), Value: tok})
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
}
