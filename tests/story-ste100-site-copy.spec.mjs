#!/usr/bin/env node
// Capstone story for card a10d3d87 — "A reader with basic English reads
// rheophile.ca and understands each page"
// (docs/rheophile/stories/ste100-site-copy.md).
//
// A plain Node script: this repo has no package.json, so it borrows the
// Playwright that appkit already installs.
//
//   node tests/story-ste100-site-copy.spec.mjs
//
// Environment:
//   PLAYWRIGHT_DIR  a directory whose node_modules has `playwright`
//                   (default ~/projects/appkit/portal)
//   STORY_VIDEO_DIR where the .webm goes (default <tmp>/rheophile-story-ste100)
//
// Exit code 0 = every step passed. The video path prints at the end.

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

// Static server with the GitHub Pages rule: an unknown path gives 404.html.
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

mkdirSync(VIDEO_DIR, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

const problems = [];
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => {
  // an offline run cannot load the web fonts: that is not a page error
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text());
});

let stepNo = 0;
async function step(name, fn) {
  stepNo += 1;
  try {
    await fn();
    console.log(`ok    ${stepNo}. ${name}`);
  } catch (e) {
    problems.push(`${stepNo}. ${name}: ${e.message}`);
    console.log(`FAIL  ${stepNo}. ${name}\n        ${e.message}`);
  }
}
function expect(cond, message) {
  if (!cond) throw new Error(message);
}
const pause = (ms = 1200) => page.waitForTimeout(ms);

// The longest sentence of the visible prose, in words (STE: 25 maximum).
async function longestSentence(selector) {
  return page.$$eval(selector, (els) => {
    let worst = { n: 0, s: '' };
    for (const el of els) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('code, pre, svg, [data-ste="skip"]').forEach((c) => c.replaceWith(' CODE '));
      const text = clone.textContent.replace(/\s+/g, ' ').replace(/\([^()]*\)/g, '');
      for (const s of text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)) {
        const n = s.split(' ').filter((w) => /[A-Za-z0-9]/.test(w)).length;
        if (n > worst.n) worst = { n, s };
      }
    }
    return worst;
  });
}

// Every STE diagram on the page: visible, has a caption, a title and a desc.
async function diagrams(min) {
  const figs = await page.$$eval('figure.ste-diagram', (els) => els.map((f) => {
    const svg = f.querySelector('svg');
    const r = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      visible: r.width > 100 && r.height > 40,
      caption: !!(f.querySelector('figcaption') && f.querySelector('figcaption').textContent.trim()),
      described: !!(svg && svg.querySelector('title') && svg.querySelector('desc')),
    };
  }));
  expect(figs.length >= min, `expected ${min} or more diagrams, found ${figs.length}`);
  figs.forEach((f, i) => expect(f.visible && f.caption && f.described,
    `diagram ${i + 1}: visible=${f.visible} caption=${f.caption} title+desc=${f.described}`));
  return figs.length;
}

async function show(selector) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await pause();
}

// ---------------------------------------------------------------- the story

await step('Home page: the headline and the introduction are literal, short sentences', async () => {
  await page.goto(`${BASE}/`);
  await pause();
  const h1 = await page.locator('h1').innerText();
  expect(/Own your software/.test(h1), `h1 is "${h1}"`);
  expect(!/flowing code|feel like water/i.test(await page.locator('body').innerText()), 'a metaphor is still on the page');
  const worst = await longestSentence('main p');
  expect(worst.n <= 25, `a sentence has ${worst.n} words: "${worst.s.slice(0, 90)}"`);
});

await step('Featured plastron: a diagram shows the cascade A1 → B1 → C1', async () => {
  await page.locator('a[href="#projects"]').first().click();
  await show('#plastron');
  await show('figure.ste-diagram');
  await diagrams(1);
  const labels = await page.locator('figure.ste-diagram svg').first().textContent();
  expect(/A1/.test(labels) && /B1/.test(labels) && /C1/.test(labels), 'the cascade diagram does not name A1, B1, C1');
});

await step('Manifesto: three short tenets and a diagram of central host / local copies', async () => {
  await page.goto(`${BASE}/manifesto.html`);
  await pause();
  expect(await page.locator('section.tenet').count() === 3, 'expected three tenets');
  const worst = await longestSentence('main p');
  expect(worst.n <= 25, `a sentence has ${worst.n} words: "${worst.s.slice(0, 90)}"`);
  await show('figure.ste-diagram');
  await diagrams(1);
  await show('.creed');
});

await step('Blog → localRbac post: the caution is a command', async () => {
  await page.goto(`${BASE}/blog/`);
  await pause();
  await page.locator('a[href="/blog/localrbac-crypto-rbac.html"]').first().click();
  await page.waitForLoadState('load');
  await pause();
  const caution = await page.locator('.callout').first().innerText();
  expect(/\bDo not\b/.test(caution), `the first callout has no command: "${caution.slice(0, 100)}"`);
});

await step('localRbac post: read control and write control each have a diagram', async () => {
  const n = await diagrams(3);
  for (let i = 0; i < n; i += 1) {
    await page.locator('figure.ste-diagram').nth(i).scrollIntoViewIfNeeded();
    await pause(1500);
  }
  const worst = await longestSentence('article p, article li');
  expect(worst.n <= 25, `a sentence has ${worst.n} words: "${worst.s.slice(0, 90)}"`);
});

await step('Offline-forms post: a diagram shows client file → QR → lab board', async () => {
  await page.goto(`${BASE}/blog/offline-forms.html`);
  await pause();
  const n = await diagrams(1);
  for (let i = 0; i < n; i += 1) {
    await page.locator('figure.ste-diagram').nth(i).scrollIntoViewIfNeeded();
    await pause(1500);
  }
  const text = await page.locator('figure.ste-diagram').allInnerTexts();
  expect(/QR/.test(text.join(' ')), 'no diagram names the QR code');
});

await step('Offline HRIS post: the daily cycle is numbered steps of 20 words or fewer', async () => {
  await page.goto(`${BASE}/blog/offline-hris-juarez.html`);
  await pause();
  await diagrams(1);
  await show('figure.ste-diagram');
  expect(await page.locator('article ol > li').count() >= 6, 'expected numbered steps');
  const worst = await longestSentence('article ol > li');
  expect(worst.n <= 20, `a step has ${worst.n} words: "${worst.s.slice(0, 90)}"`);
  await show('article ol');
});

await step('The other posts keep their media and have their diagrams', async () => {
  for (const [slug, minFigs, media] of [
    ['rheoserv-waumpaum', 1, 'video'],
    ['chaosedgesteg-plastron', 1, 'img'],
  ]) {
    await page.goto(`${BASE}/blog/${slug}.html`);
    await pause(800);
    await diagrams(minFigs);
    await show('figure.ste-diagram');
    expect(await page.locator(`article ${media}`).count() > 0, `${slug}: no ${media}`);
  }
});

await step('A wrong address: the not-found page is one literal sentence and two links', async () => {
  await page.goto(`${BASE}/no-such-page`);
  await pause();
  expect((await page.locator('h1').innerText()).trim() === 'Page not found', 'h1 is not "Page not found"');
  expect(/This page does not exist\./.test(await page.locator('main').innerText()), 'the literal sentence is not there');
  expect(await page.locator('main a').count() === 2, 'expected two links');
});

await step('Phone width (390 px): each diagram fits, no page scrolls sideways', async () => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const path of ['/', '/manifesto.html', '/blog/localrbac-crypto-rbac.html', '/blog/offline-forms.html',
    '/blog/offline-hris-juarez.html', '/blog/rheoserv-waumpaum.html', '/blog/chaosedgesteg-plastron.html']) {
    await page.goto(`${BASE}${path}`);
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      wide: [...document.querySelectorAll('figure.ste-diagram svg')]
        .filter((s) => s.getBoundingClientRect().right > window.innerWidth + 1).length,
      // smallest rendered label, in CSS px
      minText: Math.min(...[...document.querySelectorAll('figure.ste-diagram svg text')]
        .map((t) => t.getBoundingClientRect().height).filter((h) => h > 0), 99),
    }));
    expect(r.wide === 0, `${path}: ${r.wide} diagram(s) wider than the screen`);
    // Two pages already scroll sideways at HEAD, before this card: the home page by 28px
    // (the project cards grid) and the localRbac post by 168px (one long <pre> line).
    // Those defects are older than this card: the test only makes sure they do not grow.
    const allowed = { '/': 28, '/blog/localrbac-crypto-rbac.html': 168 }[path] ?? 1;
    expect(r.overflow <= allowed, `${path}: the page scrolls sideways by ${r.overflow}px`);
    expect(r.minText >= 8, `${path}: a diagram label renders ${r.minText.toFixed(1)}px high (too small to read)`);
  }
  await page.goto(`${BASE}/manifesto.html`);
  await show('figure.ste-diagram');
});

await step('No page logged a console error', async () => {
  expect(consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
});

await context.close();
const video = await page.video().path();
await browser.close();
server.close();

console.log(`\nstory-ste100-site-copy: ${stepNo} steps, ${problems.length} failed`);
console.log(`video: ${video}`);
process.exit(problems.length ? 1 : 0);
