# remote-mgmt — DSH Remote (MVP 0.1.0)

- `hub/`   Go hub: single static binary, SQLite (modernc, CGO-free), console UI embedded.
- `agent/` `dsh-remote-agent` DSH plugin (TypeScript → one esbuild bundle `index.js` + `client.js`).
- `deploy/` systemd unit, Caddy snippet (on-demand TLS + ask), deploy/push scripts, DNS records.
- `docs/`  design (v3.1).

Build & test
```
cd hub   && go test ./... && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/remote-hub-linux-amd64 .
cd agent && npm install && npm test && npm run e2e && npm run pack
```

Protocol: WSS `/agent/connect` → hashicorp/yamux (agent = client, opens stream 1 as JSON-lines control);
hello → challenge{nonce,ts} → auth{Ed25519(nonce|ts|deviceId|dra-v1)} → welcome. Hub opens one stream per
proxied connection with a `{"svc":"dsh"}\n` preamble followed by raw HTTP/1.1 (WebSocket upgrades pass through).
SSO: hub → `sso.request{base}` → agent runs `connection.authenticatedUrl` locally, GETs it on loopback,
returns only the Set-Cookie headers → hub sets them on the device subdomain and 303s.
