package main

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// pending TOTP re-binds: user id -> secret (expires after 10 minutes)
type pendingTOTP struct {
	secret  string
	expires time.Time
}

var rebind sync.Map

func (h *Hub) verifyPassword(userID int64, pw string) bool {
	var enc string
	if h.st.db.QueryRow(`SELECT pwhash FROM users WHERE id=?`, userID).Scan(&enc) != nil {
		return false
	}
	return checkPassword(pw, enc)
}

// POST /api/me/password {current, new}: changes the password and signs out every other session.
func (h *Hub) apiChangePassword(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ Current, New string }
	ip := h.clientIP(r)
	if h.lim.Locked("pw:" + ip) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	if jsonIn(r, &in) != nil || !h.verifyPassword(a.userID, in.Current) {
		h.lim.Fail("pw:" + ip)
		h.st.Audit(a.username, ip, "password.change", "", "fail")
		jsonErr(w, 403, "current password is wrong")
		return
	}
	if len(in.New) < 10 {
		jsonErr(w, 400, "password >= 10 chars")
		return
	}
	h.st.db.Exec(`UPDATE users SET pwhash=? WHERE id=?`, hashPassword(in.New), a.userID)
	h.revokeOthers(a)
	h.st.Audit(a.username, ip, "password.change", "", "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func (h *Hub) revokeOthers(a *authCtx) {
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
}

// POST /api/me/totp/begin {password} -> {secret, uri}
func (h *Hub) apiTOTPRebindBegin(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ Password string }
	ip := h.clientIP(r)
	if h.lim.Locked("pw:" + ip) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	if jsonIn(r, &in) != nil || !h.verifyPassword(a.userID, in.Password) {
		h.lim.Fail("pw:" + ip)
		jsonErr(w, 403, "password is wrong")
		return
	}
	s := newTOTPSecret()
	rebind.Store(a.userID, pendingTOTP{secret: s, expires: time.Now().Add(10 * time.Minute)})
	jsonOut(w, 200, map[string]string{"secret": s, "uri": totpURI(a.username, s)})
}

// POST /api/me/totp/finish {code}: replaces the TOTP secret; signs out other sessions.
func (h *Hub) apiTOTPRebindFinish(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct{ Code string }
	jsonIn(r, &in)
	v, ok := rebind.Load(a.userID)
	if !ok || time.Now().After(v.(pendingTOTP).expires) {
		jsonErr(w, 400, "start again")
		return
	}
	p := v.(pendingTOTP)
	if !totpCheck(p.secret, in.Code, time.Now(), nil) {
		jsonErr(w, 400, "invalid TOTP code")
		return
	}
	rebind.Delete(a.userID)
	h.st.db.Exec(`UPDATE users SET totp_enc=? WHERE id=?`, h.st.seal([]byte(p.secret)), a.userID)
	h.totpLast.Delete(a.userID)
	h.revokeOthers(a)
	h.st.Audit(a.username, h.clientIP(r), "totp.rebind", "", "ok")
	jsonOut(w, 200, map[string]bool{"ok": true})
}

func totpURI(user, secret string) string {
	return "otpauth://totp/DSH%20Remote:" + strings.ReplaceAll(user, " ", "%20") + "?secret=" + secret + "&issuer=DSH%20Remote&digits=6&period=30"
}

const pageCSS = `:root{--bg:#f6f7f9;--card:#fff;--fg:#14171c;--muted:#6b7280;--line:#e6e8ec;--accent:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#0d1014;--card:#161a20;--fg:#e8eaed;--muted:#9aa3ae;--line:#262c35;--accent:#4c8dff}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif;padding:24px}
.c{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.i{width:56px;height:56px;border-radius:16px;margin:0 auto 16px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-size:26px}
h1{font-size:20px;margin:0 0 8px}p{color:var(--muted);margin:0 0 20px}a{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600}`

// offlinePage renders the styled "device offline" page served on device subdomains.
func (h *Hub) offlinePage(w http.ResponseWriter, code int, title, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
	w.WriteHeader(code)
	refresh := ""
	if code == 503 {
		refresh = `<meta http-equiv="refresh" content="20">`
	}
	w.Write([]byte(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` + refresh + `<title>` + title + `</title><style>` + pageCSS + `</style></head><body><div class="c"><div class="i">⏻</div><h1>` + title + `</h1><p>` + msg + `</p><a href="` + h.scheme() + `://` + h.cfg.BaseHost + `/">返回控制台</a></div></body></html>`))
}
