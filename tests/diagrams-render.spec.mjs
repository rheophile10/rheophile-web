#!/usr/bin/env node
// Review spec for card a10d3d87 (written by the reviewer): each of the 14 STE
// diagrams renders correctly at a desktop width (1280 px) and at a phone
// width (390 px).
//
// The capstone spec asks only that a label is 8 px high or more. This spec
// looks at each diagram:
//   - the svg stays inside the screen;
//   - no label goes outside the svg (a cut label);
//   - no label is on top of a different label;
//   - the caption is visible below the svg.
// It prints the smallest rendered font size of each diagram (information: the
// design gives no minimum in CSS px). It records a .webm of the phone pass.
//
//   node tests/diagrams-render.spec.mjs
//
// Environment: PLAYWRIGHT_DIR (default ~/projects/appkit/portal),
// STORY_VIDEO_DIR (default <tmp>/rheophile-story-ste100).

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PW_DIR = process.env.PLAYWRIGHT_DIR || join(homedir(), 'projects/appkit/portal');
const VIDEO_DIR = process.env.STORY_VIDEO_DIR || join(tmpdir(), 'rheophile-story-ste100');
const { chromium } = createRequire(join(PW_DIR, 'package.json'))('playwright');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webm': 'video/webm', '.xml': 'application/xml', '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return res.end(await readFile(join(ROOT, '404.html')));
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const PAGES = [
  ['/', 1], ['/manifesto.html', 1], ['/blog/localrbac-crypto-rbac.html', 4], ['/blog/offline-forms.html', 2],
  ['/blog/offline-hris-juarez.html', 2], ['/blog/rheoserv-waumpaum.html', 2], ['/blog/chaosedgesteg-plastron.html', 2],
];

mkdirSync(VIDEO_DIR, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
let seen = 0;
let video = '';

for (const [width, name] of [[1280, 'desktop'], [390, 'phone']]) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    ...(name === 'phone' ? { recordVideo: { dir: VIDEO_DIR, size: { width, height: 800 } } } : {}),
  });
  const page = await context.newPage();
  for (const [path, expected] of PAGES) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(400);
    const figures = page.locator('figure.ste-diagram');
    const count = await figures.count();
    if (count !== expected) {
      failed += 1;
      console.log(`FAIL  ${name} ${path}: ${count} diagrams, expected ${expected}`);
    }
    for (let i = 0; i < count; i += 1) {
      const fig = figures.nth(i);
      await fig.scrollIntoViewIfNeeded();
      if (name === 'phone') await page.waitForTimeout(1500);
      const r = await fig.evaluate((el) => {
        const svg = el.querySelector('svg');
        const box = svg.getBoundingClientRect();
        const scale = box.width / svg.viewBox.baseVal.width;
        const texts = [...svg.querySelectorAll('text')].map((t) => ({ s: t.textContent.trim(), b: t.getBoundingClientRect(),
          px: parseFloat(getComputedStyle(t).fontSize) * scale }));
        const cut = texts.filter((t) => t.b.left < box.left - 1 || t.b.right > box.right + 1
          || t.b.top < box.top - 1 || t.b.bottom > box.bottom + 1).map((t) => t.s);
        const overlap = [];
        for (let a = 0; a < texts.length; a += 1) {
          for (let b = a + 1; b < texts.length; b += 1) {
            const w = Math.min(texts[a].b.right, texts[b].b.right) - Math.max(texts[a].b.left, texts[b].b.left);
            const h = Math.min(texts[a].b.bottom, texts[b].b.bottom) - Math.max(texts[a].b.top, texts[b].b.top);
            // the boxes of two lines of one label touch by design: count only a real overlap
            if (w > 2 && h > 0.35 * Math.min(texts[a].b.height, texts[b].b.height)) overlap.push(`${texts[a].s} × ${texts[b].s}`);
          }
        }
        const cap = el.querySelector('figcaption').getBoundingClientRect();
        return {
          inScreen: box.left >= -1 && box.right <= window.innerWidth + 1 && box.width > 100,
          cut, overlap,
          caption: cap.height > 0 && cap.top >= box.bottom - 1,
          minPx: Math.min(...texts.map((t) => t.px)),
          labels: texts.length,
        };
      });
      seen += 1;
      const ok = r.inScreen && !r.cut.length && !r.overlap.length && r.caption;
      if (!ok) failed += 1;
      console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} ${path} figure ${i + 1}: ${r.labels} labels, smallest ${r.minPx.toFixed(1)} px`
        + (ok ? '' : ` | inScreen=${r.inScreen} caption=${r.caption} cut=${JSON.stringify(r.cut)} overlap=${JSON.stringify(r.overlap)}`));
    }
  }
  await context.close();
  if (name === 'phone') video = await page.video().path();
}
await browser.close();
server.close();

console.log(`\ndiagrams-render: ${seen} diagram views (14 diagrams × 2 widths), ${failed} failed`);
console.log(`video: ${video}`);
process.exit(failed ? 1 : 0);
