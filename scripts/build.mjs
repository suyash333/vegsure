// Builds the static site into dist/. `--serve` rebuilds on change and serves it
// at http://localhost:8000 (camera access works on localhost without HTTPS).
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as esbuild from "esbuild";

const serve = process.argv.includes("--serve");
const out = "dist";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const options = {
  entryPoints: ["src/web/app.ts"],
  outdir: out,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: ["es2022", "safari15"],
  minify: !serve,
  sourcemap: true,
  chunkNames: "chunks/[name]-[hash]",
  logLevel: "info",
  define: { __PREVIEW__: "false" },
};

async function copyStatic() {
  await cp("static", out, { recursive: true });
  const app = await readFile(`${out}/app.js`).catch(() => Buffer.from(String(Date.now())));
  const version = createHash("sha256").update(app).digest("hex").slice(0, 12);
  const sw = await readFile("static/sw.js", "utf8");
  await writeFile(`${out}/sw.js`, sw.replace("__BUILD_VERSION__", version));
}

if (serve) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: "static", setup: (b) => b.onEnd(() => copyStatic()) }],
  });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 8000 });
  console.log(`VegScan running at http://localhost:${port}`);
} else {
  await esbuild.build(options);
  await copyStatic();
}
