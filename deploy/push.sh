#!/usr/bin/env bash
# Run on a machine that can ssh to the server (e.g. your Mac). Uploads the
# artifacts and runs deploy.sh. Pass --dry-run to only show the Caddyfile diff.
set -euo pipefail
SERVER="${SERVER:-root@47.115.227.123}"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAGE="/tmp/remote-hub-deploy"
ssh "$SERVER" "rm -rf $STAGE && mkdir -p $STAGE"
scp "$HERE/remote-hub-linux-amd64" "$HERE/SHA256SUMS" "$HERE/remote-hub.service" "$HERE/Caddyfile.remote-hub" "$HERE/hub.env.example" "$HERE/deploy.sh" "$SERVER:$STAGE/"
ssh -t "$SERVER" "bash $STAGE/deploy.sh $*"
