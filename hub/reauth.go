package main

import (
	"net/http"
	"strings"
	"time"
)

const reauthTTL = 10 * time.Minute

// sensitiveCapability ids that require a fresh reauth window before Hub forwards to Agent.
func sensitiveCapability(capID string) bool {
	switch capID {
	case "dsh.restart", "plugin.reload", "plugin.update":
		return true
	default:
		return false
	}
}

func (h *Hub) sessionReauthAt(sessID string) int64 {
	var at int64
	_ = h.st.db.QueryRow(`SELECT COALESCE(reauth_at,0) FROM sessions WHERE id=?`, sessID).Scan(&at)
	return at
}

func (h *Hub) setSessionReauth(sessID string, at time.Time) {
	h.st.db.Exec(`UPDATE sessions SET reauth_at=? WHERE id=?`, at.Unix(), sessID)
}

func (h *Hub) reauthFresh(sessID string, now time.Time) bool {
	at := h.sessionReauthAt(sessID)
	if at <= 0 {
		return false
	}
	return now.Sub(time.Unix(at, 0)) <= reauthTTL
}

// POST /api/me/reauth {password?} {code?} — at least one required; password and/or TOTP.
func (h *Hub) apiMeReauth(w http.ResponseWriter, r *http.Request, a *authCtx) {
	var in struct {
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	ip := h.clientIP(r)
	key := "reauth:" + ip
	if h.lim.Locked(key) {
		jsonErr(w, 429, "too many attempts")
		return
	}
	if jsonIn(r, &in) != nil {
		jsonErr(w, 400, "bad request")
		return
	}
	in.Password = strings.TrimSpace(in.Password)
	in.Code = strings.TrimSpace(in.Code)
	if in.Password == "" && in.Code == "" {
		jsonErr(w, 400, "password or TOTP code required")
		return
	}

	ok := false
	method := ""
	if in.Password != "" {
		if h.verifyPassword(a.userID, in.Password) {
			ok = true
			method = "password"
		}
	}
	if !ok && in.Code != "" {
		var enc string
		if h.st.db.QueryRow(`SELECT totp_enc FROM users WHERE id=?`, a.userID).Scan(&enc) == nil {
			sec, err := h.st.open(enc)
			lv, _ := h.totpLast.LoadOrStore(a.userID, new(int64))
			if err == nil && totpCheck(string(sec), in.Code, time.Now(), lv.(*int64)) {
				ok = true
				method = "totp"
			}
		}
	}
	if !ok {
		h.lim.Fail(key)
		h.st.Audit(a.username, ip, "reauth", a.sessID, "fail")
		jsonErr(w, 401, "reauth failed")
		return
	}
	now := time.Now()
	h.setSessionReauth(a.sessID, now)
	h.lim.Reset(key)
	h.st.Audit(a.username, ip, "reauth", a.sessID, "ok:"+method)
	jsonOut(w, 200, map[string]any{
		"ok":         true,
		"reauthAt":   now.Unix(),
		"expiresAt":  now.Add(reauthTTL).Unix(),
		"ttlSeconds": int(reauthTTL.Seconds()),
		"method":     method,
	})
}
