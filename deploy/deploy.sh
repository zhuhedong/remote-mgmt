#!/usr/bin/env bash
# Run ON the server as root, from a directory containing:
#   remote-hub-linux-amd64  remote-hub.service  Caddyfile.remote-hub  hub.env.example
# Steps: backup -> install binary/unit -> start hub -> health check -> patch Caddy
# (global on_demand_tls ask + site blocks) -> caddy validate -> reload.
# Any failure rolls back the Caddyfile and the previous hub binary.
# Usage: sudo bash deploy.sh [--caddyfile /opt/caddy/Caddyfile] [--dry-run]
set -euo pipefail
CADDYFILE=""
DRY=0
while [ $# -gt 0 ]; do case "$1" in --caddyfile) CADDYFILE="$2"; shift 2;; --dry-run) DRY=1; shift;; *) echo "unknown arg $1"; exit 2;; esac; done
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT=/opt/remote-hub
TS="$(date +%Y%m%d%H%M%S)"
BK="$ROOT/backups/deploy-$TS"
log() { echo "[deploy] $*"; }
run() { if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }

[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
for f in remote-hub-linux-amd64 remote-hub.service Caddyfile.remote-hub; do [ -f "$HERE/$f" ] || { echo "missing $f"; exit 1; }; done
if [ -f "$HERE/SHA256SUMS" ]; then (cd "$HERE" && sha256sum -c SHA256SUMS) || { echo "checksum mismatch"; exit 1; }; fi

# ---- locate Caddy ----
CADDY_MODE=host; CADDY_CTR=""
if [ -z "$CADDYFILE" ]; then
  for c in /opt/caddy/Caddyfile /opt/caddy/conf/Caddyfile /opt/caddy/config/Caddyfile /etc/caddy/Caddyfile; do [ -f "$c" ] && { CADDYFILE="$c"; break; }; done
fi
[ -n "$CADDYFILE" ] && [ -f "$CADDYFILE" ] || { echo "Caddyfile not found; pass --caddyfile"; exit 1; }
if command -v docker >/dev/null 2>&1; then
  CADDY_CTR="$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /caddy/ {print $1; exit}')"
  [ -n "$CADDY_CTR" ] && CADDY_MODE=docker
fi
caddy_cmd() { if [ "$CADDY_MODE" = docker ]; then docker exec "$CADDY_CTR" caddy "$@"; else caddy "$@"; fi; }
CADDY_IN_CTR_FILE=/etc/caddy/Caddyfile
if [ "$CADDY_MODE" = docker ]; then
  CADDY_IN_CTR_FILE="$(docker inspect "$CADDY_CTR" --format '{{range .Mounts}}{{if eq .Source "'"$CADDYFILE"'"}}{{.Destination}}{{end}}{{end}}')"
  [ -n "$CADDY_IN_CTR_FILE" ] || { echo "cannot map $CADDYFILE into container $CADDY_CTR (mounted as a directory?) — pass the right --caddyfile"; exit 1; }
  NETMODE="$(docker inspect "$CADDY_CTR" --format '{{.HostConfig.NetworkMode}}')"
else NETMODE=host; fi
log "caddy: mode=$CADDY_MODE ${CADDY_CTR:+container=$CADDY_CTR} net=$NETMODE file=$CADDYFILE version=$(caddy_cmd version 2>/dev/null | head -1)"

# hub address reachable from Caddy (never a public interface)
if [ "$NETMODE" = host ]; then BIND=127.0.0.1
else BIND="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo 172.17.0.1)"
  [ "$NETMODE" = bridge ] || BIND="$(docker network inspect "$NETMODE" --format '{{(index .IPAM.Config 0).Gateway}}')"
fi
log "hub will listen on $BIND:9440 (ask on $BIND:9441)"
case "$BIND" in 127.*|10.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|192.168.*) ;; *) echo "refusing to bind hub to non-private $BIND"; exit 1;; esac

# ---- backup ----
run mkdir -p "$BK"
run cp -a "$CADDYFILE" "$BK/Caddyfile"
[ -f "$ROOT/bin/remote-hub" ] && run cp -a "$ROOT/bin/remote-hub" "$BK/remote-hub.prev"
[ -f "$ROOT/data/hub.db" ] && run sh -c "cd $ROOT/data && tar czf $BK/data.tgz hub.db* master.key 2>/dev/null || true"
log "backup in $BK"

rollback() {
  log "ROLLBACK"
  cat "$BK/Caddyfile" > "$CADDYFILE" || true
  caddy_cmd reload --config "$CADDY_IN_CTR_FILE" --adapter caddyfile >/dev/null 2>&1 || true
  if [ -f "$BK/remote-hub.prev" ]; then cp -a "$BK/remote-hub.prev" "$ROOT/bin/remote-hub"; systemctl restart remote-hub || true
  else systemctl stop remote-hub 2>/dev/null || true; fi
  exit 1
}
[ "$DRY" = 1 ] || trap rollback ERR

# ---- install hub ----
id remotehub >/dev/null 2>&1 || run useradd --system --home "$ROOT" --shell /usr/sbin/nologin remotehub
run install -d -m 0755 "$ROOT" "$ROOT/bin"; run install -d -m 0700 -o remotehub -g remotehub "$ROOT/data"; run install -d -m 0700 "$ROOT/backups"
run install -m 0755 "$HERE/remote-hub-linux-amd64" "$ROOT/bin/remote-hub"
if [ ! -f "$ROOT/hub.env" ]; then
  if [ "$BIND" = 127.0.0.1 ]; then NETS="127.0.0.1/32,::1/128"; else NETS="$(docker network inspect "${NETMODE/default/bridge}" --format '{{(index .IPAM.Config 0).Subnet}}')"; fi
  run sh -c "sed -e 's/^HUB_LISTEN=.*/HUB_LISTEN=$BIND:9440/' -e 's/^HUB_ASK_LISTEN=.*/HUB_ASK_LISTEN=$BIND:9441/' -e 's#^HUB_TRUSTED_PROXIES=.*#HUB_TRUSTED_PROXIES=$NETS#' '$HERE/hub.env.example' > '$ROOT/hub.env'"
  run chown root:remotehub "$ROOT/hub.env"; run chmod 0640 "$ROOT/hub.env"
fi
run install -m 0644 "$HERE/remote-hub.service" /etc/systemd/system/remote-hub.service
run systemctl daemon-reload
run systemctl enable remote-hub
run systemctl restart remote-hub
if [ "$DRY" = 0 ]; then
  for i in $(seq 1 20); do curl -fsS -H 'Host: remote.zhuhedong.cn' "http://$BIND:9440/healthz" >/dev/null 2>&1 && break; sleep 0.5; [ "$i" = 20 ] && { echo "hub health check failed"; journalctl -u remote-hub -n 30 --no-pager; false; }; done
  log "hub healthy"
fi

# ---- patch Caddyfile ----
NEW="$(mktemp)"
python3 - "$CADDYFILE" "$HERE/Caddyfile.remote-hub" "$BIND" > "$NEW" <<'PY'
import re, sys
src, snip, bind = open(sys.argv[1]).read(), open(sys.argv[2]).read(), sys.argv[3]
snip = snip.replace("{$REMOTE_HUB_UPSTREAM:127.0.0.1:9440}", f"{bind}:9440")
ask = f"\ton_demand_tls {{\n\t\task http://{bind}:9441/tls-ask\n\t}}\n"
src = re.sub(r"\n?# --- remote-hub.*?# --- end remote-hub ---\n?", "\n", src, flags=re.S)
m = re.match(r"\s*\{\s*\n(.*?)\n\}\s*\n", src, flags=re.S)   # global options block
if m and "on_demand_tls" in m.group(1):
    if "tls-ask" not in m.group(1):
        sys.exit("existing on_demand_tls block without our ask endpoint; merge by hand")
elif m:
    src = src[:m.end(1)] + "\n" + ask.rstrip("\n") + src[m.end(1):]
else:
    src = "{\n" + ask + "}\n\n" + src
print(src.rstrip("\n") + "\n\n" + snip, end="")
PY
# validate the candidate BEFORE touching the live file (stdin works for host and docker caddy)
validate_candidate() { if [ "$CADDY_MODE" = docker ]; then docker exec -i "$CADDY_CTR" caddy validate --config /dev/stdin --adapter caddyfile < "$NEW"; else caddy validate --config /dev/stdin --adapter caddyfile < "$NEW"; fi; }
if [ "$DRY" = 1 ]; then
  log "dry-run: proposed Caddyfile diff:"; diff -u "$CADDYFILE" "$NEW" || true
  if validate_candidate >/tmp/remote-hub-validate.log 2>&1; then log "dry-run: candidate Caddyfile is VALID"; else log "dry-run: candidate Caddyfile INVALID:"; tail -5 /tmp/remote-hub-validate.log; fi
  rm -f "$NEW"; exit 0
fi
validate_candidate >/dev/null
# write in place (keeps the inode: the Caddyfile is a single-file bind mount)
cat "$NEW" > "$CADDYFILE"; rm -f "$NEW"
caddy_cmd reload --config "$CADDY_IN_CTR_FILE" --adapter caddyfile
trap - ERR
log "done. Setup token: run  sudo cat $ROOT/data/setup-token  (shown only on the server; delete after setup is automatic)."
log "rollback later: cat $BK/Caddyfile > $CADDYFILE && docker exec $CADDY_CTR caddy reload --config $CADDY_IN_CTR_FILE --adapter caddyfile; systemctl disable --now remote-hub"
