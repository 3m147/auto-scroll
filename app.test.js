const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

test("fullscreen hides controls and viewer handles click gestures", () => {
  const css = readFileSync("style.css", "utf8");
  const js = readFileSync("script.js", "utf8");

  assert.match(css, /:fullscreen\s+\.toolbar\s*{[^}]*display:\s*none;/s);
  assert.match(css, /:fullscreen\s+\.app\s*{[^}]*grid-template-rows:\s*1fr;/s);
  assert.match(js, /viewer\.addEventListener\("click",\s*handleViewerClick\)/);
  assert.match(js, /viewer\.addEventListener\("dblclick",\s*handleViewerDoubleClick\)/);
});

test("loaded files hide the empty state so it cannot open the file picker", () => {
  const css = readFileSync("style.css", "utf8");
  const js = readFileSync("script.js", "utf8");

  assert.match(css, /\.empty-state\[hidden\],\s*\.viewer\.has-file\s+\.empty-state\s*{[^}]*display:\s*none\s*!important;/s);
  assert.match(css, /\.viewer\.has-file\s+\.empty-state\s*{[^}]*display:\s*none\s*!important;/s);
  assert.match(js, /function hideDropZone\(\)\s*{[^}]*viewer\.classList\.add\("has-file"\)/s);
  assert.match(js, /dropZone\.style\.display\s*=\s*"none"/);
  assert.match(js, /dropZone\.style\.pointerEvents\s*=\s*"none"/);
  assert.match(js, /function handleDropZoneClick\(\)\s*{[^}]*viewer\.classList\.contains\("has-file"\)/s);
  assert.match(js, /dropZone\.addEventListener\("click",\s*handleDropZoneClick\)/);
});

test("speed control adjusts in 0.1 increments", () => {
  const html = readFileSync("index.html", "utf8");

  assert.match(html, /id="speedInput"[^>]*step="0\.1"/);
});
