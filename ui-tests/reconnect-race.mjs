// Regression: racing connect/disconnect must not leave two links kicking each other (was a ~1s reconnect loop).
import { startEnv, sleep } from "./env.mjs";
const env = await startEnv(process.argv[2]); await env.doSetup(); await env.login(); await env.devices();
const a = env.agent; await a.handler("disconnect"); a.handler("connect"); await sleep(5); a.handler("disconnect"); a.handler("connect"); a.handler("connect");
await sleep(3000); const c1=(await env.req("GET","/api/audit")).json.length; await sleep(8000); const c2=(await env.req("GET","/api/audit")).json.length;
const st = (await a.handler("status")).state; console.log("audit growth over 8s:", c2 - c1, st); env.stop(); process.exit(c2 - c1 === 0 && st === "online" ? 0 : 1);
