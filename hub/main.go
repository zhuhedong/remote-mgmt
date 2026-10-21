package main

import (
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var version = "0.1.0"

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func setupTokenPath(dir string) string { return filepath.Join(dir, "setup-token") }
func removeSetupToken(dir string)      { os.Remove(setupTokenPath(dir)) }

func main() {
	var c Config
	flag.StringVar(&c.Listen, "listen", env("HUB_LISTEN", "127.0.0.1:9440"), "main listener (behind Caddy)")
	flag.StringVar(&c.AskListen, "ask-listen", env("HUB_ASK_LISTEN", "127.0.0.1:9441"), "on-demand TLS ask listener (loopback only)")
	flag.StringVar(&c.DataDir, "data", env("HUB_DATA", "/opt/remote-hub/data"), "data directory")
	flag.StringVar(&c.BaseHost, "base-host", env("HUB_BASE_HOST", "remote.zhuhedong.cn"), "console hostname")
	flag.StringVar(&c.Zone, "zone", env("HUB_ZONE", "d.remote.zhuhedong.cn"), "device service zone")
	insecure := flag.Bool("insecure", os.Getenv("HUB_INSECURE") == "1", "plain-http cookies (tests only)")
	trust := flag.Bool("trust-proxy", env("HUB_TRUST_PROXY", "1") == "1", "trust X-Forwarded-For from loopback")
	nets := flag.String("trusted-proxies", env("HUB_TRUSTED_PROXIES", "127.0.0.1/32,::1/128"), "CIDRs whose X-Forwarded-For is trusted")
	showVer := flag.Bool("version", false, "print version")
	flag.Parse()
	if *showVer {
		println(version)
		return
	}
	c.Insecure, c.TrustProxy = *insecure, *trust
	for _, cidr := range strings.Split(*nets, ",") {
		if _, n, err := net.ParseCIDR(strings.TrimSpace(cidr)); err == nil {
			c.TrustedNets = append(c.TrustedNets, n)
		}
	}
	c.BaseHost, c.Zone = strings.ToLower(c.BaseHost), strings.ToLower(c.Zone)
	st, err := OpenStore(c.DataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	h := &Hub{cfg: c, st: st, reg: &Registry{m: map[string]*Agent{}}, lim: NewLimiter()}
	if h.userCount() == 0 {
		tok := randToken()[:24]
		h.setup.token = tok
		p := setupTokenPath(c.DataDir)
		if err := os.WriteFile(p, []byte(tok+"\n"), 0o600); err != nil {
			log.Fatalf("write setup token: %v", err)
		}
		log.Printf("first-run setup required; one-time setup token written to %s (not logged)", p)
	} else {
		removeSetupToken(c.DataDir)
	}
	go func() {
		srv := &http.Server{Addr: c.AskListen, Handler: h.AskHandler(), ReadHeaderTimeout: 5 * time.Second}
		log.Printf("ask listener on %s", c.AskListen)
		if err := srv.ListenAndServe(); err != nil {
			log.Printf("ask listener: %v", err)
		}
	}()
	go func() {
		for range time.Tick(time.Hour) {
			now := time.Now().Unix()
			st.db.Exec(`DELETE FROM tickets WHERE expires<?`, now)
			st.db.Exec(`DELETE FROM enroll_codes WHERE expires<?`, now-86400)
			st.db.Exec(`DELETE FROM service_sessions WHERE expires<?`, now)
			st.db.Exec(`DELETE FROM audit WHERE ts<?`, now-180*86400)
		}
	}()
	srv := &http.Server{Addr: c.Listen, Handler: h.Routes(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 120 * time.Second}
	log.Printf("remote-hub %s listening on %s (console %s, zone %s)", version, c.Listen, c.BaseHost, c.Zone)
	log.Fatal(srv.ListenAndServe())
}
