package main

import (
	"testing"
	"time"
)

func TestA1RiskAndTimeouts(t *testing.T) {
	for id, want := range map[string]string{
		"chat.prompt": "normal", "models.select": "normal", "chat.follow": "observe",
		"models.list": "observe", "dsh.restart": "sensitive",
	} {
		if got := capabilityRisk(id); got != want {
			t.Fatalf("%s risk=%s want %s", id, got, want)
		}
		if sensitiveCapability(id) != (want == "sensitive") {
			t.Fatalf("%s sensitive mismatch", id)
		}
		if l0Permission(id) != "open" && id != "dsh.restart" {
			t.Fatalf("%s permission %s", id, l0Permission(id))
		}
	}
	if invokeTimeout("chat.follow") <= 20*time.Second {
		t.Fatal("follow timeout must exceed agent long-poll")
	}
	if !quietAudit("chat.follow") || quietAudit("chat.prompt") {
		t.Fatal("audit policy")
	}
}
