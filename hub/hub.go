package main

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed web
var webFS embed.FS

type Config struct {
	Listen, AskListen, DataDir string
	BaseHost, Zone             string // remote.zhuhedong.cn, d.remote.zhuhedong.cn
	Insecure                   bool   // http + non-__Host cookies (local tests only)
	TrustProxy                 bool   // trust X-Forwarded-For from TrustedNets (Caddy)
	TrustedNets                []*net.IPNet
}

type Hub struct {
	cfg  Config
	st   *Store
	reg  *Registry
	lim  *Limiter
	pre  sync.Map // pre-auth token hash -> preAuth
	setup struct {
		mu     sync.Mutex
		token  string
		secret string
	}
	totpLast sync.Map // user id -> *int64
}

type preAuth struct {
	userID  int64
	expires time.Time
}

const (
	sessTTL     = 7 * 24 * time.Hour
	sessAbs     = 30 * 24 * time.Hour
	ticketTTL   = 30 * time.Second
	enrollTTL   = 10 * time.Minute
	svcDSH      = "dsh"
)

func (h *Hub) cookieName(n string) string {
	if h.cfg.Insecure {
		return "rh_" + n
	}
	return "__Host-rh_" + n
}

func (h *Hub) setCookie(w http.ResponseWriter, name, val string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: h.cookieName(name), Value: val, Path: "/", HttpOnly: true, Secure: !h.cfg.Insecure, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}

func (h *Hub) scheme() string {
	if h.cfg.Insecure {
		return "http"
	}
	return "https"
}

func (h *Hub) clientIP(r *http.Request) string {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if h.cfg.TrustProxy && h.trusted(host) {
		if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
			parts := strings.Split(xf, ",")
			return strings.TrimSpace(parts[len(parts)-1])
		}
	}
	return host
}

func (h *Hub) trusted(ip string) bool {
	p := net.ParseIP(ip)
	if p == nil {
		return false
	}
	if len(h.cfg.TrustedNets) == 0 {
		return p.IsLoopback()
	}
	for _, n := range h.cfg.TrustedNets {
		if n.Contains(p) {
			return true
		}
	}
	return false
}

func hostOnly(h string) string {
	if i := strings.LastIndex(h, ":"); i > 0 && !strings.Contains(h[i:], "]") {
		h = h[:i]
	}
	return strings.ToLower(h)
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.Trim(slugRe.ReplaceAllString(strings.ToLower(s), "-"), "-")
	s = strings.ReplaceAll(s, "--", "-")
	if len(s) > 30 {
		s = strings.Trim(s[:30], "-")
	}
	if s == "" {
		s = "device"
	}
	return s
}

func (h *Hub) serviceHost(svc, slug string) string { return svc + "--" + slug + "." + h.cfg.Zone }

// parseServiceHost: "dsh--macbook.d.remote.x" -> ("dsh","macbook",true)
func (h *Hub) parseServiceHost(host string) (string, string, bool) {
	suf := "." + h.cfg.Zone
	if !strings.HasSuffix(host, suf) {
		return "", "", false
	}
	label := strings.TrimSuffix(host, suf)
	if strings.Contains(label, ".") {
		return "", "", false
	}
	i := strings.Index(label, "--")
	if i <= 0 || i+2 >= len(label) {
		return "", "", false
	}
	return label[:i], label[i+2:], true
}

func (h *Hub) Routes() http.Handler {
	api := http.NewServeMux()
	api.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	api.HandleFunc("GET /api/state", h.apiState)
	api.HandleFunc("POST /api/auth/setup/begin", h.apiSetupBegin)
	api.HandleFunc("POST /api/auth/setup/finish", h.apiSetupFinish)
	api.HandleFunc("POST /api/auth/login", h.apiLogin)
	api.HandleFunc("POST /api/auth/totp", h.apiTOTP)
	api.HandleFunc("POST /api/auth/logout", h.authed(h.apiLogout))
	api.HandleFunc("GET /api/me", h.authed(h.apiMe))
	api.HandleFunc("GET /api/sessions", h.authed(h.apiSessions))
	api.HandleFunc("POST /api/sessions/revoke", h.authed(h.apiSessionRevoke))
	api.HandleFunc("GET /api/devices", h.authed(h.apiDevices))
	api.HandleFunc("POST /api/enroll-codes", h.authed(h.apiEnrollCode))
	api.HandleFunc("POST /api/devices/activate", h.authed(h.apiDeviceActivate))
	api.HandleFunc("POST /api/devices/revoke", h.authed(h.apiDeviceRevoke))
	api.HandleFunc("POST /api/open", h.authed(h.apiOpen))
	api.HandleFunc("GET /api/audit", h.authed(h.apiAudit))
	api.HandleFunc("POST /api/me/password", h.authed(h.apiChangePassword))
	api.HandleFunc("POST /api/me/totp/begin", h.authed(h.apiTOTPRebindBegin))
	api.HandleFunc("POST /api/me/totp/finish", h.authed(h.apiTOTPRebindFinish))
	api.HandleFunc("POST /agent/enroll", h.agentEnroll)
	api.HandleFunc("GET /agent/connect", h.handleAgentConnect)
	sub, _ := fs.Sub(webFS, "web")
	static := http.FileServer(http.FS(sub))
	api.Handle("GET /", static)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := hostOnly(r.Host)
		if svc, slug, ok := h.parseServiceHost(host); ok {
			h.serveDevice(w, r, host, svc, slug)
			return
		}
		if host != h.cfg.BaseHost {
			http.Error(w, "unknown host", 421)
			return
		}
		secHeaders(w)
		if r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/api/") && !h.sameOrigin(r) {
			http.Error(w, "csrf", 403)
			return
		}
		api.ServeHTTP(w, r)
	})
}

func secHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
}

// sameOrigin: API POSTs must carry X-Hub: 1 (not settable cross-site without CORS) and, if present, a matching Origin.
func (h *Hub) sameOrigin(r *http.Request) bool {
	if r.Header.Get("X-Hub") != "1" {
		return false
	}
	if o := r.Header.Get("Origin"); o != "" {
		u, err := url.Parse(o)
		if err != nil || hostOnly(u.Host) != h.cfg.BaseHost {
			return false
		}
	}
	return true
}

func jsonOut(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
func jsonErr(w http.ResponseWriter, code int, msg string) { jsonOut(w, code, map[string]string{"error": msg}) }
func jsonIn(r *http.Request, v any) error {
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, 64*1024)).Decode(v)
}

type authCtx struct {
	userID   int64
	username string
	sessID   string
}

// session resolves the main console session cookie.
func (h *Hub) session(r *http.Request) (*authCtx, bool) {
	c, err := r.Cookie(h.cookieName("sid"))
	if err != nil {
		return nil, false
	}
	return h.sessionByHash(hashTok(c.Value), true)
}

func (h *Hub) sessionByHash(hash string, touch bool) (*authCtx, bool) {
	var a authCtx
	var exp, created, last int64
	err := h.st.db.QueryRow(`SELECT s.id,s.user_id,u.username,s.expires,s.created,s.last_seen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.revoked=0`, hash).Scan(&a.sessID, &a.userID, &a.username, &exp, &created, &last)
	if err != nil {
		return nil, false
	}
	now := time.Now()
	if now.Unix() > exp || now.Sub(time.Unix(created, 0)) > sessAbs {
		return nil, false
	}
	if touch && now.Unix()-last > 60 {
		h.st.db.Exec(`UPDATE sessions SET last_seen=?, expires=? WHERE id=?`, now.Unix(), now.Add(sessTTL).Unix(), a.sessID)
	}
	return &a, true
}

func (h *Hub) sessionByID(id string) bool {
	var exp, created int64
	var revoked int
	if h.st.db.QueryRow(`SELECT expires,created,revoked FROM sessions WHERE id=?`, id).Scan(&exp, &created, &revoked) != nil {
		return false
	}
	return revoked == 0 && time.Now().Unix() <= exp && time.Since(time.Unix(created, 0)) <= sessAbs
}

func (h *Hub) authed(f func(http.ResponseWriter, *http.Request, *authCtx)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, ok := h.session(r)
		if !ok {
			jsonErr(w, 401, "unauthorized")
			return
		}
		f(w, r, a)
	}
}

func (h *Hub) userCount() int {
	var n int
	h.st.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n
}

func (h *Hub) apiState(w http.ResponseWriter, r *http.Request) {
	_, ok := h.session(r)
	jsonOut(w, 200, map[string]any{"setupRequired": h.userCount() == 0, "authenticated": ok, "zone": h.cfg.Zone})
}

func (h *Hub) setupTokenOK(t string) bool {
	h.setup.mu.Lock()
	defer h.setup.mu.Unlock()
	return h.setup.token != "" && t != "" && hashTok(t) == hashTok(h.setup.token) && h.userCount() == 0
}

func (h *Hub) apiSetupBegin(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token string }
	ip := h.clientIP(r)
	if h.lim.Locked("setup:"+ip) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	if jsonIn(r, &in) != nil || !h.setupTokenOK(in.Token) {
		h.lim.Fail("setup:" + ip)
		jsonErr(w, 403, "invalid setup token")
		return
	}
	h.setup.mu.Lock()
	h.setup.secret = newTOTPSecret()
	s := h.setup.secret
	h.setup.mu.Unlock()
	jsonOut(w, 200, map[string]string{"secret": s, "uri": totpURI("owner", s)})
}

func (h *Hub) apiSetupFinish(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Username, Password, Code string }
	ip := h.clientIP(r)
	if jsonIn(r, &in) != nil || !h.setupTokenOK(in.Token) {
		h.lim.Fail("setup:" + ip)
		jsonErr(w, 403, "invalid setup token")
		return
	}
	in.Username = strings.TrimSpace(in.Username)
	if len(in.Username) < 2 || len(in.Password) < 10 {
		jsonErr(w, 400, "username >= 2 chars, password >= 10 chars")
		return
	}
	h.setup.mu.Lock()
	sec := h.setup.secret
	h.setup.mu.Unlock()
	if sec == "" || !totpCheck(sec, in.Code, time.Now(), nil) {
		jsonErr(w, 400, "invalid TOTP code")
		return
	}
	_, err := h.st.db.Exec(`INSERT INTO users(username,pwhash,totp_enc,role,created) VALUES(?,?,?,?,?)`, in.Username, hashPassword(in.Password), h.st.seal([]byte(sec)), "owner", time.Now().Unix())
	if err != nil {
		jsonErr(w, 409, "setup already done")
		return
	}
	h.setup.mu.Lock()
	h.setup.token, h.setup.secret = "", ""
	h.setup.mu.Unlock()
	removeSetupToken(h.cfg.DataDir)
	h.st.Audit(in.Username, ip, "setup", "", "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) apiLogin(w http.ResponseWriter, r *http.Request) {
	var in struct{ Username, Password string }
	ip := h.clientIP(r)
	if jsonIn(r, &in) != nil {
		jsonErr(w, 400, "bad request")
		return
	}
	key := "login:" + ip
	ukey := "user:" + strings.ToLower(in.Username)
	if h.lim.Locked(key) || h.lim.Locked(ukey) {
		jsonErr(w, 429, "too many attempts, try later")
		return
	}
	var id int64
	var pw string
	err := h.st.db.QueryRow(`SELECT id,pwhash FROM users WHERE username=?`, in.Username).Scan(&id, &pw)
	if err != nil || !checkPassword(in.Password, pw) {
		h.lim.Fail(key)
		h.lim.Fail(ukey)
		h.st.Audit(in.Username, ip, "login.password", "", "fail")
		jsonErr(w, 401, "wrong username or password")
		return
	}
	tok := randToken()
	h.pre.Store(hashTok(tok), preAuth{userID: id, expires: time.Now().Add(2 * time.Minute)})
	h.setCookie(w, "pre", tok, 120)
	jsonOut(w, 200, map[string]any{"totp": true})
}

func (h *Hub) apiTOTP(w http.ResponseWriter, r *http.Request) {
	var in struct{ Code string }
	ip := h.clientIP(r)
	c, err := r.Cookie(h.cookieName("pre"))
	if err != nil || jsonIn(r, &in) != nil {
		jsonErr(w, 401, "login first")
		return
	}
	v, ok := h.pre.Load(hashTok(c.Value))
	if !ok || time.Now().After(v.(preAuth).expires) {
		jsonErr(w, 401, "login expired")
		return
	}
	pa := v.(preAuth)
	ukey := "totp:" + ip
	if h.lim.Locked(ukey) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	var enc, uname string
	h.st.db.QueryRow(`SELECT totp_enc,username FROM users WHERE id=?`, pa.userID).Scan(&enc, &uname)
	sec, err := h.st.open(enc)
	lv, _ := h.totpLast.LoadOrStore(pa.userID, new(int64))
	if err != nil || !totpCheck(string(sec), in.Code, time.Now(), lv.(*int64)) {
		h.lim.Fail(ukey)
		h.st.Audit(uname, ip, "login.totp", "", "fail")
		jsonErr(w, 401, "wrong code")
		return
	}
	h.pre.Delete(hashTok(c.Value))
	h.setCookie(w, "pre", "", -1)
	tok := randToken()
	sid := hex.EncodeToString(randBytes(8))
	now := time.Now()
	ua := r.UserAgent()
	if len(ua) > 200 {
		ua = ua[:200]
	}
	h.st.db.Exec(`INSERT INTO sessions(id,hash,user_id,created,last_seen,expires,ip,ua) VALUES(?,?,?,?,?,?,?,?)`, sid, hashTok(tok), pa.userID, now.Unix(), now.Unix(), now.Add(sessTTL).Unix(), ip, ua)
	h.setCookie(w, "sid", tok, int(sessAbs.Seconds()))
	h.lim.Reset("login:" + ip)
	h.st.Audit(uname, ip, "login", sid, "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) apiLogout(w http.ResponseWriter, r *http.Request, a *authCtx) {
	h.revokeSession(a.sessID)
	h.setCookie(w, "sid", "", -1)
	h.st.Audit(a.username, h.clientIP(r), "logout", a.sessID, "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) revokeSession(id string) {
	h.st.db.Exec(`UPDATE sessions SET revoked=1 WHERE id=?`, id)
	h.st.db.Exec(`DELETE FROM service_sessions WHERE session_id=?`, id)
}

func (h *Hub) apiMe(w http.ResponseWriter, r *http.Request, a *authCtx) {
	jsonOut(w, 200, map[string]any{"username": a.username, "session": a.sessID})
}

func (h *Hub) apiSessions(w http.ResponseWriter, r *http.Request, a *authCtx) {
	rows, _ := h.st.db.Query(`SELECT id,created,last_seen,ip,ua FROM sessions WHERE user_id=? AND revoked=0 AND expires>? ORDER BY last_seen DESC`, a.userID, time.Now().Unix())
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, ip, ua string
		var c, l int64
		rows.Scan(&id, &c, &l, &ip, &ua)
		out = append(out, map[string]any{"id": id, "created": c, "lastSeen": l, "ip": ip, "ua": ua, "current": id == a.sessID})
	}
	jsonOut(w, 200, out)
}

func (h *Hub) apiSessionRevoke(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct {
		ID  string
		All bool
	}
	jsonIn(r, &in)
	if in.All {
		rows, _ := h.st.db.Query(`SELECT id FROM sessions WHERE user_id=? AND revoked=0 AND id<>?`, a.userID, a.sessID)
		var ids []string
		for rows.Next() {
			var id string
			rows.Scan(&id)
			ids = append(ids, id)
		}
		rows.Close()
		for _, id := range ids {
			h.revokeSession(id)
		}
	} else {
		var uid int64
		if h.st.db.QueryRow(`SELECT user_id FROM sessions WHERE id=?`, in.ID).Scan(&uid) != nil || uid != a.userID {
			jsonErr(w, 404, "not found")
			return
		}
		h.revokeSession(in.ID)
	}
	h.st.Audit(a.username, h.clientIP(r), "session.revoke", in.ID, "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) apiDevices(w http.ResponseWriter, r *http.Request, a *authCtx) {
	rows, _ := h.st.db.Query(`SELECT id,name,slug,pubkey,status,COALESCE(hostname,''),COALESCE(versions,''),created,COALESCE(last_seen,0) FROM devices WHERE status<>'revoked' ORDER BY created`)
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, slug, pub, status, hn, ver string
		var created, last int64
		rows.Scan(&id, &name, &slug, &pub, &status, &hn, &ver, &created, &last)
		d := map[string]any{"id": id, "name": name, "slug": slug, "status": status, "hostname": hn, "created": created, "lastSeen": last, "fingerprint": fingerprint(pub), "online": false, "services": []map[string]string{{"id": svcDSH, "name": "DSH", "host": h.serviceHost(svcDSH, slug)}}}
		var vv map[string]any
		if json.Unmarshal([]byte(ver), &vv) == nil {
			d["versions"] = vv
		}
		if ag := h.reg.Get(id); ag != nil {
			d["online"] = true
			d["since"] = ag.Since.Unix()
			d["status_report"] = ag.Status.Load()
		}
		out = append(out, d)
	}
	jsonOut(w, 200, out)
}

func fingerprint(pubB64 string) string {
	raw, _ := base64.StdEncoding.DecodeString(pubB64)
	s := sha256.Sum256(raw)
	return hex.EncodeToString(s[:])[:12]
}

func (h *Hub) apiEnrollCode(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ Name string }
	jsonIn(r, &in)
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 60 {
		jsonErr(w, 400, "name required")
		return
	}
	const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := randBytes(12)
	var sb strings.Builder
	for i, c := range b {
		if i > 0 && i%4 == 0 {
			sb.WriteByte('-')
		}
		sb.WriteByte(alpha[int(c)%len(alpha)])
	}
	code := sb.String()
	exp := time.Now().Add(enrollTTL)
	h.st.db.Exec(`INSERT INTO enroll_codes(hash,name,created,expires) VALUES(?,?,?,?)`, hashTok(normCode(code)), in.Name, time.Now().Unix(), exp.Unix())
	h.st.Audit(a.username, h.clientIP(r), "enroll.code", in.Name, "ok")
	jsonOut(w, 200, map[string]any{"code": code, "expires": exp.Unix(), "hub": h.scheme() + "://" + h.cfg.BaseHost})
}

func normCode(c string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(c))
}

func (h *Hub) agentEnroll(w http.ResponseWriter, r *http.Request) {
	ip := h.clientIP(r)
	if h.lim.Locked("enroll:" + ip) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	var in struct {
		Code, Pubkey, Hostname string
		Versions               map[string]string
	}
	if jsonIn(r, &in) != nil {
		jsonErr(w, 400, "bad request")
		return
	}
	pk, err := base64.StdEncoding.DecodeString(in.Pubkey)
	if err != nil || len(pk) != ed25519.PublicKeySize {
		jsonErr(w, 400, "bad public key")
		return
	}
	hash := hashTok(normCode(in.Code))
	var name string
	var exp int64
	var used int
	tx, _ := h.st.db.Begin()
	defer tx.Rollback()
	err = tx.QueryRow(`SELECT name,expires,used FROM enroll_codes WHERE hash=?`, hash).Scan(&name, &exp, &used)
	if err != nil || used != 0 || time.Now().Unix() > exp {
		tx.Rollback()
		h.lim.Fail("enroll:" + ip)
		h.st.Audit("", ip, "device.enroll", "", "bad code")
		jsonErr(w, 403, "invalid or expired enrollment code")
		return
	}
	tx.Exec(`UPDATE enroll_codes SET used=1 WHERE hash=?`, hash)
	id := hex.EncodeToString(randBytes(10))
	base := slugify(name)
	slug := base
	for i := 2; ; i++ {
		var x string
		if tx.QueryRow(`SELECT id FROM devices WHERE slug=?`, slug).Scan(&x) == sql.ErrNoRows {
			break
		}
		slug = base + "-" + itoa(i)
	}
	vb, _ := json.Marshal(in.Versions)
	hn := in.Hostname
	if len(hn) > 100 {
		hn = hn[:100]
	}
	if _, err := tx.Exec(`INSERT INTO devices(id,name,slug,pubkey,status,hostname,versions,created) VALUES(?,?,?,?,?,?,?,?)`, id, name, slug, in.Pubkey, "pending", hn, string(vb), time.Now().Unix()); err != nil {
		tx.Rollback()
		jsonErr(w, 500, "db")
		return
	}
	tx.Commit()
	h.st.Audit("", ip, "device.enroll", id, "pending")
	jsonOut(w, 200, map[string]any{"deviceId": id, "name": name, "slug": slug, "fingerprint": fingerprint(in.Pubkey), "hosts": []string{h.serviceHost(svcDSH, slug)}})
}

func itoa(i int) string { return strconv.Itoa(i) }

func (h *Hub) apiDeviceActivate(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ ID, Fingerprint string }
	jsonIn(r, &in)
	var pub, st string
	if h.st.db.QueryRow(`SELECT pubkey,status FROM devices WHERE id=?`, in.ID).Scan(&pub, &st) != nil || st != "pending" {
		jsonErr(w, 404, "no pending device")
		return
	}
	if !strings.HasPrefix(fingerprint(pub), strings.ToLower(strings.TrimSpace(in.Fingerprint))) || len(strings.TrimSpace(in.Fingerprint)) < 6 {
		jsonErr(w, 400, "fingerprint mismatch (enter at least the first 6 characters shown in DSH)")
		return
	}
	h.st.db.Exec(`UPDATE devices SET status='active' WHERE id=?`, in.ID)
	h.st.Audit(a.username, h.clientIP(r), "device.activate", in.ID, "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) apiDeviceRevoke(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ ID string }
	jsonIn(r, &in)
	res, _ := h.st.db.Exec(`UPDATE devices SET status='revoked' WHERE id=? AND status<>'revoked'`, in.ID)
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, 404, "not found")
		return
	}
	var slug string
	h.st.db.QueryRow(`SELECT slug FROM devices WHERE id=?`, in.ID).Scan(&slug)
	// free the slug for future enrollments and drop service sessions
	h.st.db.Exec(`UPDATE devices SET slug=slug||'~'||id WHERE id=?`, in.ID)
	h.st.db.Exec(`DELETE FROM service_sessions WHERE host LIKE ?`, "%--"+slug+"."+h.cfg.Zone)
	h.reg.Kick(in.ID)
	h.st.Audit(a.username, h.clientIP(r), "device.revoke", in.ID, "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) deviceBySlug(slug string) (id string, ok bool) {
	var st string
	if h.st.db.QueryRow(`SELECT id,status FROM devices WHERE slug=?`, slug).Scan(&id, &st) != nil || st != "active" {
		return "", false
	}
	return id, true
}

func (h *Hub) apiOpen(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ Device, Service string }
	jsonIn(r, &in)
	if in.Service == "" {
		in.Service = svcDSH
	}
	var slug, st string
	if h.st.db.QueryRow(`SELECT slug,status FROM devices WHERE id=?`, in.Device).Scan(&slug, &st) != nil || st != "active" || in.Service != svcDSH {
		jsonErr(w, 404, "no such device/service")
		return
	}
	host := h.serviceHost(in.Service, slug)
	t := randToken()
	h.st.db.Exec(`INSERT INTO tickets(hash,session_id,host,expires) VALUES(?,?,?,?)`, hashTok(t), a.sessID, host, time.Now().Add(ticketTTL).Unix())
	h.st.Audit(a.username, h.clientIP(r), "service.open", host, "ok")
	jsonOut(w, 200, map[string]string{"url": h.scheme() + "://" + host + "/__hub/enter?t=" + url.QueryEscape(t)})
}

func (h *Hub) apiAudit(w http.ResponseWriter, r *http.Request, a *authCtx) {
	rows, _ := h.st.db.Query(`SELECT ts,COALESCE(user,''),COALESCE(ip,''),action,COALESCE(target,''),COALESCE(result,'') FROM audit ORDER BY id DESC LIMIT 200`)
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var ts int64
		var u, ip, ac, t, res string
		rows.Scan(&ts, &u, &ip, &ac, &t, &res)
		out = append(out, map[string]any{"ts": ts, "user": u, "ip": ip, "action": ac, "target": t, "result": res})
	}
	jsonOut(w, 200, out)
}

// ---- device subdomains ----

func (h *Hub) loginRedirect(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, h.scheme()+"://"+h.cfg.BaseHost+"/", http.StatusSeeOther)
}

func (h *Hub) serveDevice(w http.ResponseWriter, r *http.Request, host, svc, slug string) {
	devID, ok := h.deviceBySlug(slug)
	if !ok || svc != svcDSH {
		h.offlinePage(w, 404, "找不到这台设备", "这个地址对应的设备不存在或已被移除。")
		return
	}
	if r.URL.Path == "/__hub/enter" {
		h.enter(w, r, host, devID)
		return
	}
	// service session
	c, err := r.Cookie(h.cookieName("svc"))
	if err != nil {
		h.loginRedirect(w, r)
		return
	}
	var sessID string
	var exp int64
	if h.st.db.QueryRow(`SELECT session_id,expires FROM service_sessions WHERE hash=? AND host=?`, hashTok(c.Value), host).Scan(&sessID, &exp) != nil || time.Now().Unix() > exp || !h.sessionByID(sessID) {
		h.loginRedirect(w, r)
		return
	}
	if r.URL.Path == "/__hub/sso" {
		h.sso(w, r, host, devID, "/")
		return
	}
	ag := h.reg.Get(devID)
	if ag == nil {
		h.offlinePage(w, 503, "设备当前离线", "这台 DSH 暂时没有连接到 Hub。请确认电脑已开机、DSH 正在运行；页面会每 20 秒自动重试。")
		return
	}
	h.proxy(ag, svc, host).ServeHTTP(w, r)
}

func (h *Hub) enter(w http.ResponseWriter, r *http.Request, host, devID string) {
	t := r.URL.Query().Get("t")
	var sessID string
	var exp int64
	var used int
	hash := hashTok(t)
	if t == "" || h.st.db.QueryRow(`SELECT session_id,expires,used FROM tickets WHERE hash=? AND host=?`, hash, host).Scan(&sessID, &exp, &used) != nil || used != 0 || time.Now().Unix() > exp || !h.sessionByID(sessID) {
		h.loginRedirect(w, r)
		return
	}
	h.st.db.Exec(`UPDATE tickets SET used=1 WHERE hash=?`, hash)
	h.st.db.Exec(`DELETE FROM tickets WHERE expires<?`, time.Now().Unix()-60)
	tok := randToken()
	h.st.db.Exec(`INSERT INTO service_sessions(hash,session_id,host,expires) VALUES(?,?,?,?)`, hashTok(tok), sessID, host, time.Now().Add(sessAbs).Unix())
	h.setCookie(w, "svc", tok, int(sessAbs.Seconds()))
	h.sso(w, r, host, devID, "/")
}

// sso asks the agent to run DSH's connection.authenticatedUrl locally and hands the resulting cookies to the browser.
func (h *Hub) sso(w http.ResponseWriter, r *http.Request, host, devID, next string) {
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	ag := h.reg.Get(devID)
	if ag != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		res, err := ag.Call(ctx, "sso.request", map[string]any{"svc": svcDSH, "base": h.scheme() + "://" + host + "/"})
		if err == nil {
			if arr, ok := res["setCookie"].([]any); ok {
				for _, v := range arr {
					if s, ok := v.(string); ok && len(s) < 4096 {
						w.Header().Add("Set-Cookie", s)
					}
				}
			}
		}
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

var proxyCache sync.Map // devID|svc -> *httputil.ReverseProxy (bound to an Agent)

func (h *Hub) proxy(ag *Agent, svc, host string) http.Handler {
	key := ag.DeviceID + "|" + svc
	if p, ok := proxyCache.Load(key); ok {
		pp := p.(*boundProxy)
		if pp.ag == ag {
			return pp
		}
	}
	tr := &http.Transport{
		DialContext:         func(ctx context.Context, _, _ string) (net.Conn, error) { return ag.OpenService(svc) },
		MaxIdleConnsPerHost: 16,
		IdleConnTimeout:     60 * time.Second,
		ResponseHeaderTimeout: 120 * time.Second,
	}
	sc := h.cookieName("svc")
	rp := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL.Scheme = "http"
			pr.Out.URL.Host = "device.local"
			pr.Out.Host = pr.In.Host // DSH checks Host against trustedHosts
			stripCookie(pr.Out, sc)
			pr.Out.Header.Del("X-Forwarded-For")
			pr.Out.Header.Set("X-Forwarded-For", h.clientIP(pr.In))
			pr.Out.Header.Set("X-Forwarded-Proto", h.scheme())
			pr.Out.Header.Set("X-Forwarded-Host", pr.In.Host)
		},
		Transport:     tr,
		FlushInterval: -1,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			http.Error(w, "device unreachable", 502)
		},
	}
	bp := &boundProxy{ag: ag, h: rp}
	proxyCache.Store(key, bp)
	go func() { <-ag.sess.CloseChan(); tr.CloseIdleConnections(); proxyCache.CompareAndDelete(key, bp) }()
	return bp
}

type boundProxy struct {
	ag *Agent
	h  http.Handler
}

func (b *boundProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) { b.h.ServeHTTP(w, r) }

func stripCookie(r *http.Request, name string) {
	cs := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cs {
		if c.Name != name && !strings.HasPrefix(c.Name, "__Host-rh_") && !strings.HasPrefix(c.Name, "rh_") {
			r.AddCookie(c)
		}
	}
}

// ---- on-demand TLS ask (separate loopback listener) ----

func (h *Hub) AskHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		d := strings.ToLower(r.URL.Query().Get("domain"))
		if r.URL.Path == "/tls-ask" && h.allowCert(d) {
			w.WriteHeader(200)
			return
		}
		w.WriteHeader(404)
	})
}

func (h *Hub) allowCert(d string) bool {
	if d == h.cfg.BaseHost {
		return true
	}
	svc, slug, ok := h.parseServiceHost(d)
	if !ok || svc != svcDSH {
		return false
	}
	_, ok = h.deviceBySlug(slug)
	return ok
}
