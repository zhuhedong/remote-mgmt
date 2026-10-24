package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// End-to-end-ish HTTP smoke: list instances + capabilities + status invoke + reauth gate.
func TestHTTPSmokeCapabilityFlow(t *testing.T) {
	h, tok := testHubWithSession(t)
	cookie := &http.Cookie{Name: h.cookieName("sid"), Value: tok}

	cleanup := startFakeCapAgent(t, h, "dev1", func(m map[string]any) map[string]any {
		switch m["type"] {
		case "capability.list":
			return map[string]any{
				"agentCapVersion": 1,
				"capabilities": []map[string]any{
					{"id": "instance.status", "title": "状态", "params": map[string]any{"type": "object"}, "stream": false, "permission": "open", "sensitive": false},
					{"id": "dsh.restart", "title": "重启", "params": map[string]any{"type": "object"}, "stream": false, "permission": "restart", "sensitive": true},
				},
			}
		case "capability.invoke":
			cap, _ := m["capability"].(string)
			if cap == "instance.status" {
				return map[string]any{"ok": true, "requestId": m["requestId"], "data": map[string]any{"dshReady": true, "plugin": "0.1.0"}}
			}
			return map[string]any{"ok": true, "requestId": m["requestId"], "data": map[string]any{"dryRun": true, "executed": false}}
		default:
			return map[string]any{"error": "unsupported"}
		}
	})
	defer cleanup()

	// instances alias
	req := httptest.NewRequest("GET", "http://remote.x.cn/api/instances", nil)
	req.AddCookie(cookie)
	rr := httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("instances %d", rr.Code)
	}

	req = httptest.NewRequest("GET", "http://remote.x.cn/api/instances/dev1/capabilities", nil)
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("caps %d %s", rr.Code, rr.Body.String())
	}

	body := `{"id":"instance.status","params":{},"requestId":"smoke-1"}`
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("status invoke %d %s", rr.Code, rr.Body.String())
	}
	var out map[string]any
	json.Unmarshal(rr.Body.Bytes(), &out)
	if out["ok"] != true {
		t.Fatal(out)
	}

	body = `{"id":"dsh.restart","params":{},"requestId":"smoke-2"}`
	req = httptest.NewRequest("POST", "http://remote.x.cn/api/instances/dev1/invoke", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub", "1")
	req.AddCookie(cookie)
	rr = httptest.NewRecorder()
	h.Routes().ServeHTTP(rr, req)
	if rr.Code != 401 {
		t.Fatalf("want reauth 401 got %d", rr.Code)
	}
}
