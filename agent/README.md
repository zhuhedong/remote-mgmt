# dsh-remote-agent

DSH plugin that connects this DSH to a self-hosted **DSH Remote hub**
(outbound WSS only, works behind NAT / Clash). From the hub console you can
open this DSH from any phone or browser, with single sign-on into DSH.

- Sidebar: **远程** → enter hub address + enrollment code → check the fingerprint in the hub console and activate.
- Device key: macOS Keychain (fallback: AES-GCM encrypted file in `profiles/web/.dsh-remote-agent/`).
- Adds `dsh--<device>.d.<hub zone>` to `connection.trustedHosts` in `profiles/web/cordis.patch.yml` (backup first). Restart DSH once afterwards.
- `/remote status|connect|disconnect` command.
- Only the local dsh web is exposed; DSH's launch token never leaves this machine.

Offline install: `pnpm add ./dsh-remote-agent-0.1.0.tgz` inside `profiles/web` with DSH's bundled pnpm (no registry access needed; dependencies are bundled).
