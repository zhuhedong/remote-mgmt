package main

import (
	"net"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTOTPVector(t *testing.T) {
	sec := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" // RFC 6238 SHA1 seed
	cases := map[int64]string{59: "287082", 1111111109: "081804", 1234567890: "005924", 2000000000: "279037"}
	for ts, want := range cases {
		if got := totpAt(sec, time.Unix(ts, 0)); got != want {
			t.Fatalf("t=%d got %s want %s", ts, got, want)
		}
	}
	var last int64
	now := time.Unix(1234567890, 0)
	if !totpCheck(sec, "005924", now, &last) {
		t.Fatal("valid code rejected")
	}
	if totpCheck(sec, "005924", now, &last) {
		t.Fatal("replay accepted")
	}
	if totpCheck(sec, "000000", now, nil) {
		t.Fatal("wrong code accepted")
	}
}

func TestPassword(t *testing.T) {
	h := hashPassword("correct horse")
	if !checkPassword("correct horse", h) || checkPassword("wrong", h) || checkPassword("x", "garbage") {
		t.Fatal("password check")
	}
}

func TestServiceHost(t *testing.T) {
	h := &Hub{cfg: Config{BaseHost: "remote.x.cn", Zone: "d.remote.x.cn"}}
	svc, slug, ok := h.parseServiceHost("dsh--macbook-pro.d.remote.x.cn")
	if !ok || svc != "dsh" || slug != "macbook-pro" {
		t.Fatal(svc, slug, ok)
	}
	for _, bad := range []string{"d.remote.x.cn", "macbook.d.remote.x.cn", "a.dsh--m.d.remote.x.cn", "dsh--m.d.remote.x.cn.evil.com", "--m.d.remote.x.cn", "dsh--.d.remote.x.cn"} {
		if _, _, ok := h.parseServiceHost(bad); ok {
			t.Fatal("accepted", bad)
		}
	}
	if h.serviceHost("dsh", "m") != "dsh--m.d.remote.x.cn" {
		t.Fatal("serviceHost")
	}
}

func TestSlugify(t *testing.T) {
	for in, want := range map[string]string{"MacBook Pro": "macbook-pro", "我的电脑": "device", "a--b": "a-b", "--x--": "x"} {
		if got := slugify(in); got != want {
			t.Fatalf("%q -> %q want %q", in, got, want)
		}
	}
}

func TestLimiter(t *testing.T) {
	l := NewLimiter()
	for i := 0; i < 4; i++ {
		l.Fail("k")
	}
	if l.Locked("k") {
		t.Fatal("locked early")
	}
	l.Fail("k")
	if !l.Locked("k") {
		t.Fatal("not locked")
	}
}

func TestSameOriginAndAsk(t *testing.T) {
	st, err := OpenStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := &Hub{cfg: Config{BaseHost: "remote.x.cn", Zone: "d.remote.x.cn"}, st: st, reg: &Registry{m: map[string]*Agent{}}, lim: NewLimiter()}
	r := httptest.NewRequest("POST", "http://remote.x.cn/api/auth/login", nil)
	if h.sameOrigin(r) {
		t.Fatal("missing X-Hub accepted")
	}
	r.Header.Set("X-Hub", "1")
	r.Header.Set("Origin", "https://evil.com")
	if h.sameOrigin(r) {
		t.Fatal("foreign origin accepted")
	}
	r.Header.Set("Origin", "https://remote.x.cn")
	if !h.sameOrigin(r) {
		t.Fatal("same origin rejected")
	}
	st.db.Exec(`INSERT INTO devices(id,name,slug,pubkey,status,created) VALUES('a','A','mac','x','active',0),('b','B','old','x','pending',0)`)
	for d, want := range map[string]bool{"remote.x.cn": true, "dsh--mac.d.remote.x.cn": true, "dsh--old.d.remote.x.cn": false, "dsh--nope.d.remote.x.cn": false, "foo--mac.d.remote.x.cn": false, "evil.com": false} {
		if h.allowCert(d) != want {
			t.Fatalf("allowCert(%s) != %v", d, want)
		}
	}
	enc := st.seal([]byte("SECRET"))
	if p, err := st.open(enc); err != nil || string(p) != "SECRET" {
		t.Fatal("seal/open")
	}
}

func TestTrustedProxy(t *testing.T) {
	_, n, _ := net.ParseCIDR("172.17.0.0/16")
	h := &Hub{cfg: Config{TrustProxy: true, TrustedNets: []*net.IPNet{n}}}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "172.17.0.2:5555"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 1.2.3.4")
	if h.clientIP(r) != "1.2.3.4" {
		t.Fatal(h.clientIP(r))
	}
	r.RemoteAddr = "8.8.8.8:1"
	if h.clientIP(r) != "8.8.8.8" {
		t.Fatal("untrusted peer XFF honoured")
	}
}
