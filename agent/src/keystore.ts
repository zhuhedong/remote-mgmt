// Device private key storage: macOS Keychain via the `security` CLI (value is
// fed through `security -i` stdin, never argv), else an AES-256-GCM file whose
// key is derived from the machine id. No native modules (DSH's Node ABI varies).
import { execFile, spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, generateKeyPairSync, createPrivateKey, createPublicKey, sign, KeyObject } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { join, dirname } from "node:path";

const SERVICE = "dsh-remote-agent";
const ACCOUNT = "device-key";

export interface KeyStore { kind: string; load(): Promise<string | null>; save(v: string): Promise<void>; clear(): Promise<void> }

function run(cmd: string, args: string[], input?: string, timeout = 15000): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const c = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const t = setTimeout(() => c.kill("SIGKILL"), timeout);
    c.stdout.on("data", (d) => (out += d));
    c.on("error", () => { clearTimeout(t); res({ code: -1, out: "" }); });
    c.on("close", (code) => { clearTimeout(t); res({ code: code ?? -1, out }); });
    if (input !== undefined) c.stdin.end(input); else c.stdin.end();
  });
}

export class KeychainStore implements KeyStore {
  kind = "keychain";
  constructor(private bin = "/usr/bin/security") {}
  async available() { return process.platform === "darwin" && existsSync(this.bin); }
  async load() {
    const r = await run(this.bin, ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]);
    return r.code === 0 ? r.out.trim() || null : null;
  }
  async save(v: string) {
    if (!/^[A-Za-z0-9+/=]+$/.test(v)) throw new Error("unexpected key encoding");
    const r = await run(this.bin, ["-i"], `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -l "DSH Remote Agent device key" -w ${v}\n`);
    if (r.code !== 0) throw new Error("keychain write failed");
    if ((await this.load()) !== v) throw new Error("keychain verify failed");
  }
  async clear() { await run(this.bin, ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]); }
}

function machineId(): Promise<string> {
  return new Promise((res) => {
    if (process.platform === "darwin") {
      execFile("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { timeout: 5000 }, (e, out) => {
        const m = /"IOPlatformUUID" = "([^"]+)"/.exec(String(out || ""));
        res(m ? m[1] : hostname());
      });
      return;
    }
    for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) { try { const v = readFileSync(p, "utf8").trim(); if (v) return res(v); } catch {} }
    res(hostname());
  });
}

/** Fallback: protects against casual copying of the data dir, not against local root. */
export class FileStore implements KeyStore {
  kind = "file";
  constructor(private file: string, private idSource: () => Promise<string> = machineId) {}
  async load() {
    if (!existsSync(this.file)) return null;
    try {
      const j = JSON.parse(readFileSync(this.file, "utf8"));
      const key = scryptSync(await this.idSource(), Buffer.from(j.salt, "base64"), 32);
      const d = createDecipheriv("aes-256-gcm", key, Buffer.from(j.iv, "base64"));
      d.setAuthTag(Buffer.from(j.tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(j.data, "base64")), d.final()]).toString("utf8");
    } catch { return null; }
  }
  async save(v: string) {
    const salt = randomBytes(16), iv = randomBytes(12);
    const key = scryptSync(await this.idSource(), salt, 32);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([c.update(v, "utf8"), c.final()]);
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    writeFileSync(this.file, JSON.stringify({ v: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }), { mode: 0o600 });
  }
  async clear() { rmSync(this.file, { force: true }); }
}

export async function pickStore(dir: string, prefer?: string): Promise<KeyStore> {
  const kc = new KeychainStore();
  if (prefer !== "file" && (await kc.available())) return kc;
  return new FileStore(join(dir, "device-key.enc"));
}

// ---- Ed25519 helpers ----
export function newDeviceKey(): { pkcs8: string; pub: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { pkcs8: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), pub: rawPub(publicKey) };
}
export function rawPub(k: KeyObject): string {
  const der = k.export({ type: "spki", format: "der" }) as Buffer;
  return der.subarray(der.length - 32).toString("base64");
}
export function loadKey(pkcs8: string) {
  const priv = createPrivateKey({ key: Buffer.from(pkcs8, "base64"), format: "der", type: "pkcs8" });
  return { priv, pub: rawPub(createPublicKey(priv)) };
}
export function signMsg(priv: KeyObject, msg: string): string { return sign(null, Buffer.from(msg), priv).toString("base64"); }
