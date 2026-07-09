# Deploying rheophile.ca

Static site, no framework and no build step: hand-written HTML plus a few
JSON data files and small helper scripts. Everything is served as-is from the
repo root.

Layout:
- `index.html` — home (hero, Projects, Blog teaser)
- `blog/index.html` — tag-filterable blog index; `blog/*.html` — the posts
- `assets/projects.json` — the Projects grid data (edit this to add a project)
- `assets/blog-posts.json` — the post index (drives the grid, the RSS feed, and per-post meta)
- `assets/blog-ui.js` — client-side rendering for projects, blog grid, tag filter
- `feed.xml` / `sitemap.xml` — generated (do not hand-edit; see Updating)
- `robots.txt` — allows all, disallows `/apps/`, points at the sitemap
- `404.html` — branded not-found page (GitHub Pages serves it automatically)
- `scripts/` — `generate-rss.py`, `generate-sitemap.py`, `sync-blog-meta.py`, OG-card generators

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

**Add a project:** append an object to `assets/projects.json` (set
`"featured": true` to make it the plastron-style lead; otherwise it lands in
the "Other projects" grid). The home page renders it — no HTML edit needed.

**Add a blog post:**
1. Add the post HTML under `blog/`.
2. Add its entry to `assets/blog-posts.json`.
3. Regenerate meta + feed:
   ```bash
   python3 scripts/sync-blog-meta.py     # injects OG/Twitter meta into the post
   python3 scripts/generate-rss.py       # rewrites feed.xml from blog-posts.json
   python3 scripts/generate-sitemap.py   # rewrites sitemap.xml from blog-posts.json
   ```
The home page grid, the `/blog/` index, and its tag filter all pick the post
up automatically from `blog-posts.json`.

Commit + push = deployed. Every update is a timestamped public artifact.
