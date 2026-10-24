# remote-mgmt — DSH Remote (MVP 0.1.0)

- `hub/`   Go hub: single static binary, SQLite (modernc, CGO-free), console UI embedded.
- `agent/` `dsh-remote-agent` DSH plugin (TypeScript → one esbuild bundle `index.js` + `client.js`).
- `android/` Kotlin + Compose client (capability bridge L0).
- `deploy/` systemd unit, Caddy snippet (on-demand TLS + ask), deploy/push scripts, DNS records.
- `docs/`  design (v2 / Android + capability bridge).

## Build & test (local)

```bash
cd hub   && go test ./... && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/remote-hub-linux-amd64 .
cd agent && npm ci && npm test && npm run pack
cd android && ./gradlew :app:assembleDebug   # needs JDK 17 + Android SDK
```

## CI / downloads

Workflows live under [`.github/workflows/`](.github/workflows/):

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** (`ci.yml`) | push / PR to `master` | `go test`, `npm test`, Android `assembleDebug` → artifact **app-debug** (14 days) |
| **Release** (`release.yml`) | tag `v*`, or manual **workflow_dispatch** | builds Hub linux/amd64 binary, Agent tgz, APK; creates a [GitHub Release](https://github.com/zhuhedong/remote-mgmt/releases) with `SHA256SUMS` |

**Get builds**

- CI debug APK: [Actions](https://github.com/zhuhedong/remote-mgmt/actions) → latest green **CI** run → Artifacts
- Release assets: [Releases](https://github.com/zhuhedong/remote-mgmt/releases)

**Cut a release**

```bash
git tag v0.1.0-a0
git push origin v0.1.0-a0
```

Or: Actions → **Release** → Run workflow → input tag (e.g. `v0.1.0-a0`).

Optional Android signing secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Without them the release APK is **debug** (noted in release notes).

## Protocol (short)

WSS `/agent/connect` → hashicorp/yamux (agent = client, opens stream 1 as JSON-lines control);
hello → challenge{nonce,ts} → auth{Ed25519(nonce|ts|deviceId|dra-v1)} → welcome. Hub opens one stream per
proxied connection with a `{"svc":"dsh"}\n` preamble followed by raw HTTP/1.1 (WebSocket upgrades pass through).
SSO: hub → `sso.request{base}` → agent runs `connection.authenticatedUrl` locally, GETs it on loopback,
returns only the Set-Cookie headers → hub sets them on the device subdomain and 303s.

Capability bridge (Android L0): console `POST /api/instances/{id}/capabilities|invoke` → control
`capability.list` / `capability.invoke` → agent Bridge handlers (`instance.*`, `logs.tail`, `services.health`, gated ops).
