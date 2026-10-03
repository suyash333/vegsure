// Builds a single-file preview of the checker for publishing as a claude.ai
// artifact. That sandbox blocks the camera, OCR downloads and calls to Open Food
// Facts, so the preview build hides scanning and offers typed and sample labels.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as esbuild from "esbuild";

const out = process.argv[2] ?? "dist-preview/vegsure-preview.html";
const result = await esbuild.build({
  entryPoints: ["src/web/app.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022", "safari15"],
  minify: true,
  write: false,
  define: { __PREVIEW__: "true" },
  external: ["tesseract.js", "barcode-detector/ponyfill"],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = await readFile("static/styles.css", "utf8");
const html = `<title>VegSure</title>
<style>
${css}
.topbar { top: env(safe-area-inset-top, 0px); padding-top: 10px; }
</style>
<header class="topbar">
  <h1><span class="logo" aria-hidden="true">🌿</span> VegSure</h1>
  <button id="diet-button" class="diet-chip" type="button" aria-label="Change diet">Vegetarian</button>
</header>
<main id="app"></main>
<script>${js}</script>
`;
await mkdir(out.replace(/\/[^/]+$/, ""), { recursive: true });
await writeFile(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
