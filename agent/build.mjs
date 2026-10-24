import { build } from "esbuild";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "index.js",
  external: ["@deepseek-ai/schemastery"],
  legalComments: "none",
  banner: {
    js: "// dsh-remote-agent bundle (generated). Source: src/*.ts\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});
console.log("built index.js");

function listTs(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (f.endsWith(".ts")) out.push(p);
  }
  return out;
}

await build({
  entryPoints: listTs("src"),
  outdir: "test/.build",
  outbase: "src",
  platform: "node",
  format: "esm",
  target: "node18",
  bundle: false,
  logLevel: "error",
});
