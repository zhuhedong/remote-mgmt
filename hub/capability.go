package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// CapabilityDescriptor is frozen for A0 (aligned with agent bridge/types.ts + design v2 §4.1).
type CapabilityDescriptor struct {
	ID              string          `json:"id"`
	Title           string          `json:"title"`
	Description     string          `json:"description,omitempty"`
	Params          json.RawMessage `json:"params"`
	Stream          bool            `json:"stream"`
	Permission      string          `json:"permission"` // open|manage|restart|update
	Sensitive       bool            `json:"sensitive"`
	MinAgentVersion string          `json:"minAgentVersion,omitempty"`
	Category        string          `json:"category,omitempty"`
}

type capListReply struct {
	AgentCapVersion int                    `json:"agentCapVersion"`
	Capabilities    []CapabilityDescriptor `json:"capabilities"`
	Stale           bool                   `json:"stale,omitempty"`
	Online          bool                   `json:"online"`
}

func (h *Hub) deviceOwned(_ *authCtx, deviceID string) (slug, status string, ok bool) {
	var st, sl string
	if h.st.db.QueryRow(`SELECT slug,status FROM devices WHERE id=?`, deviceID).Scan(&sl, &st) != nil {
		return "", "", false
	}
	if st == "revoked" {
		return "", "", false
	}
	return sl, st, true
}

// ownerPass: A0 simple ACL — any authenticated console user may list/invoke (single-owner Hub).
func (h *Hub) allowCapability(_ *authCtx, permission string) bool {
	switch permission {
	case "open", "manage", "restart", "update", "":
		return true
	default:
		return false
	}
}

func (h *Hub) apiInstanceCapabilities(w http.ResponseWriter, r *http.Request, a *authCtx) {
	id := r.PathValue("id")
	if id == "" {
		jsonErr(w, 400, "missing instance id")
		return
	}
	if _, st, ok := h.deviceOwned(a, id); !ok {
		jsonErr(w, 404, "instance not found")
		return
	} else if st != "active" {
		jsonErr(w, 409, "instance not active")
		return
	}
	ag := h.reg.Get(id)
	if ag == nil {
		jsonOut(w, 503, map[string]any{"error": "OFFLINE", "code": "OFFLINE", "online": false})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	res, err := ag.Call(ctx, "capability.list", map[string]any{})
	if err != nil {
		h.st.Audit(a.username, h.clientIP(r), "capability.list", id, "fail:"+err.Error())
		jsonErr(w, 502, "agent: "+err.Error())
		return
	}
	out := capListReply{Online: true}
	if v, ok := res["agentCapVersion"].(float64); ok {
		out.AgentCapVersion = int(v)
	}
	if raw, ok := res["capabilities"]; ok {
		b, _ := json.Marshal(raw)
		_ = json.Unmarshal(b, &out.Capabilities)
	}
	if out.Capabilities == nil {
		out.Capabilities = []CapabilityDescriptor{}
	}
	h.st.Audit(a.username, h.clientIP(r), "capability.list", id, "ok")
	jsonOut(w, 200, out)
}

func (h *Hub) apiInstanceInvoke(w http.ResponseWriter, r *http.Request, a *authCtx) {
	id := r.PathValue("id")
	if id == "" {
		jsonErr(w, 400, "missing instance id")
		return
	}
	if _, st, ok := h.deviceOwned(a, id); !ok {
		jsonErr(w, 404, "instance not found")
		return
	} else if st != "active" {
		jsonErr(w, 409, "instance not active")
		return
	}
	var in struct {
		ID        string          `json:"id"`
		Params    json.RawMessage `json:"params"`
		RequestID string          `json:"requestId"`
	}
	if jsonIn(r, &in) != nil || strings.TrimSpace(in.ID) == "" || strings.TrimSpace(in.RequestID) == "" {
		jsonErr(w, 400, "id and requestId required")
		return
	}
	// A0: owner passes known L0 permissions
	if !h.allowCapability(a, l0Permission(in.ID)) {
		h.st.Audit(a.username, h.clientIP(r), "capability.invoke", id+"/"+in.ID, "forbidden")
		jsonOut(w, 403, map[string]any{"ok": false, "requestId": in.RequestID, "code": "FORBIDDEN", "message": "permission denied"})
		return
	}
	// Sensitive ops require reauth within reauthTTL; do not forward to Agent without it.
	if sensitiveCapability(in.ID) && !h.reauthFresh(a.sessID, time.Now()) {
		h.st.Audit(a.username, h.clientIP(r), "capability.invoke", id+"/"+in.ID, "reauth_required")
		jsonOut(w, 401, map[string]any{
			"ok": false, "requestId": in.RequestID,
			"code":    "REAUTH_REQUIRED",
			"message": "re-authenticate within the last 10 minutes (POST /api/me/reauth)",
		})
		return
	}
	ag := h.reg.Get(id)
	if ag == nil {
		jsonOut(w, 503, map[string]any{"ok": false, "requestId": in.RequestID, "code": "OFFLINE", "message": "instance offline", "error": "OFFLINE"})
		return
	}
	params := any(map[string]any{})
	if len(in.Params) > 0 && string(in.Params) != "null" {
		var p any
		if json.Unmarshal(in.Params, &p) == nil {
			params = p
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), invokeTimeout(in.ID))
	defer cancel()
	quiet := quietAudit(in.ID)
	res, err := ag.Call(ctx, "capability.invoke", map[string]any{
		"capability": in.ID,
		"params":     params,
		"requestId":  in.RequestID,
	})
	if err != nil {
		h.st.Audit(a.username, h.clientIP(r), "capability.invoke", id+"/"+in.ID, "fail:"+err.Error())
		jsonOut(w, 502, map[string]any{"ok": false, "requestId": in.RequestID, "code": "INTERNAL", "message": err.Error()})
		return
	}
	// Agent reply is already {ok, requestId, data|code,message} merged into reply map (plus type/id).
	ok, _ := res["ok"].(bool)
	out := map[string]any{"requestId": in.RequestID, "ok": ok}
	if ok {
		out["data"] = res["data"]
		if !quiet {
			h.st.Audit(a.username, h.clientIP(r), "capability.invoke", id+"/"+in.ID, "ok")
		}
		jsonOut(w, 200, out)
		return
	}
	code, _ := res["code"].(string)
	msg, _ := res["message"].(string)
	if code == "" {
		code = "INTERNAL"
	}
	out["code"] = code
	out["message"] = msg
	h.st.Audit(a.username, h.clientIP(r), "capability.invoke", id+"/"+in.ID, "err:"+code)
	status := 400
	switch code {
	case "NOT_FOUND":
		status = 404
	case "NOT_IMPLEMENTED":
		status = 501
	case "FORBIDDEN", "UNAUTHORIZED":
		status = 403
	case "REAUTH_REQUIRED":
		status = 401
	case "OFFLINE":
		status = 503
	case "INTERNAL":
		status = 502
	}
	jsonOut(w, status, out)
}

// l0Permission maps known capability ids to ACL verbs (unknown → open; agent still validates).
func l0Permission(capID string) string {
	switch capID {
	case "instance.logs.tail":
		return "manage"
	case "dsh.restart", "plugin.reload":
		return "restart"
	case "plugin.update":
		return "update"
	default:
		return "open"
	}
}

// capabilityRisk classifies capabilities for UI/audit: observe | normal | sensitive.
// A1 chat.prompt and models.select are "normal": user-gestured, no reauth.
func capabilityRisk(capID string) string {
	if sensitiveCapability(capID) {
		return "sensitive"
	}
	switch capID {
	case "chat.prompt", "chat.session.create", "chat.cancel", "models.select":
		return "normal"
	}
	return "observe"
}

// invokeTimeout bounds one Agent round trip. chat.follow is a long-poll (agent waits ≤20s).
func invokeTimeout(capID string) time.Duration {
	switch capID {
	case "chat.follow":
		return 28 * time.Second
	case "chat.prompt", "models.list", "chat.sessions.list", "chat.history":
		return 45 * time.Second
	}
	return 30 * time.Second
}

// quietAudit skips success audit rows for high-frequency read polls.
func quietAudit(capID string) bool {
	return capID == "chat.follow" || capID == "chat.history" || capID == "chat.sessions.list" || capID == "models.list"
}
