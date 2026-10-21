# DNS records to add (Aliyun DNS / 云解析 for zhuhedong.cn)

| 主机记录 (RR) | 类型 | 记录值 | TTL |
|---|---|---|---|
| `remote` | A | `47.115.227.123` | 600 |
| `*.d.remote` | A | `47.115.227.123` | 600 |

Status checked 2026-10-21 19:2x (UTC+8) via DoH (alidns + cloudflare):
- `remote.zhuhedong.cn` → NXDOMAIN (not yet created)
- `*.d.remote.zhuhedong.cn` (tested `dsh--test.d.remote.zhuhedong.cn`) → NXDOMAIN
- `zhuhedong.cn` → 47.115.227.123 (NS: hichina / Aliyun DNS)

No new security-group ports are needed: Caddy already serves 80/443; the hub
listens only on loopback / docker bridge. Port 80 must stay open for the
ACME HTTP-01 challenge used by on-demand TLS.
