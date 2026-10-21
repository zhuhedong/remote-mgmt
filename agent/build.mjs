import { build } from "esbuild";
await build({ entryPoints: ["src/index.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: "index.js",
  external: ["@deepseek-ai/schemastery"], legalComments: "none",
  banner: { js: "// dsh-remote-agent bundle (generated). Source: src/*.ts\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
console.log("built index.js");
// per-module build for unit tests
import { readdirSync } from "node:fs";
await build({ entryPoints: readdirSync("src").filter((f) => f.endsWith(".ts")).map((f) => "src/" + f), outdir: "test/.build", platform: "node", format: "esm", target: "node18", bundle: false, logLevel: "error" });
