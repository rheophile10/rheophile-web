# Deploying rheophile.ca

Static site served as-is from the repo root — GitHub Pages runs **no** CI
build. There is a small **local** build (`scripts/build.sh`) whose outputs
(compiled CSS, injected meta, pre-rendered cards, feed, sitemap) are committed,
so the deployed site stays plain static files. Rebuild locally, commit, push.

Layout:
- `index.html` — home (hero, Projects, Blog teaser)
- `blog/index.html` — tag-filterable blog index; `blog/*.html` — the posts
- `assets/projects.json` — the Projects grid data (edit this to add a project)
- `assets/blog-posts.json` — the post index (drives the grid, the RSS feed, and per-post meta)
- `assets/blog-ui.js` — client-side rendering for projects, blog grid, tag filter
- `assets/tailwind.css` — **compiled** Tailwind (built from `tailwind.config.js` +
  `scripts/tailwind.input.css`; do not hand-edit). Pages link this instead of the
  old `cdn.tailwindcss.com` Play CDN.
- The JS-rendered grids are also **pre-rendered** into the HTML (between
  `<!-- prerender:* -->` markers) so crawlers and no-JS visitors see full content;
  `blog-ui.js` re-renders identical markup at runtime and wires the tag filter.
- Analytics: none for now (`normalize-head.py` strips any analytics tag).
- `feed.xml` / `sitemap.xml` — generated (do not hand-edit; see Updating)
- `robots.txt` — allows all, disallows `/apps/`, points at the sitemap
- `404.html` — branded not-found page (GitHub Pages serves it automatically)
- `scripts/build.sh` — runs every generator + the Tailwind compile (below)

## Fastest path (GitHub Pages, free, fits the artifact strategy)

```bash
cd ~/projects/rheophile/website
git init && git add index.html blog assets feed.xml scripts DEPLOY.md README.md CNAME && git commit -m "rheophile.ca"
gh repo create rheophile10/rheophile.ca --public --source=. --push
gh api repos/rheophile10/rheophile.ca/pages -X POST -f "source[branch]=master" -f "source[path]=/"
```

Then point DNS at GitHub Pages (at your registrar):
- `A` records on apex: 185.199.108.153 / .109. / .110. / .111.
- Add file `CNAME` containing `rheophile.ca` to the repo.
- In repo Settings → Pages → custom domain → rheophile.ca → enforce HTTPS.

Alternative: Netlify drop (drag the folder at app.netlify.com/drop, then add domain).

## The portal (nav → Login → rheophile.ca/apps/)

Login lives in the **portal**, not this page: the nav Login button links to
`/apps/`, which is the rheophile-branded appkit portal built from
`~/projects/rheophile/apps` (see that repo + `~/projects/appkit/SETUP.md`).
Because it's served from the same origin and Supabase project, this homepage
notices the portal session in localStorage and swaps Login for an account chip
(see the SESSION CHIP script at the bottom of `index.html`) — no Supabase code
ships with the homepage itself.

Publishing/updating the portal page:

```bash
cd ~/projects/rheophile/apps
npm run deploy:site    # builds with the rheophile brand → ../website/apps/index.html
# then commit + push this repo
```

The script refuses to build until `brand/.env` has the real Supabase URL/key
(otherwise the page would point at localhost). One-time Supabase setup lives in
`~/projects/appkit/SETUP.md`; remember to add `https://rheophile.ca/apps/` to
the project's Auth → Redirect URLs.

`apps/index.html` is a build artifact — regenerate it, don't edit it.

## Updating

Whatever you change, finish with **`bash scripts/build.sh`**, then commit. The
build is idempotent and needs `python3` + `npx` (it fetches Tailwind v3 on first
run). It runs, in order: `sync-blog-meta` → `prerender` → `generate-rss` →
`generate-sitemap` → `normalize-head` → Tailwind compile.

**Add a project:** append an object to `assets/projects.json` (set
`"featured": true` to make it the plastron-style lead; otherwise it lands in
the "Other projects" grid), then `bash scripts/build.sh`.

**Add a blog post:**
1. Add the post HTML under `blog/` (start from an existing post's `<head>`).
2. Add its entry to `assets/blog-posts.json`.
3. Run `bash scripts/build.sh` — it injects meta + JSON-LD into the post,
   pre-renders the grids, refreshes the feed/sitemap, normalizes the new page's
   head (Tailwind link, font links, analytics), and recompiles the CSS.

Commit + push = deployed. Every update is a timestamped public artifact.
