# Deploying rheophile.ca

The site is one file: `index.html` (+ `assets/pfp.jpg`). No build step. The Vite plan
in SITE-PLAN.md is retired — single-file is the brand.

## Fastest path (GitHub Pages, free, fits the artifact strategy)

```bash
cd ~/projects/rheophile/website
git init && git add index.html assets DEPLOY.md && git commit -m "rheophile.ca"
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

Edit `index.html` directly:
- New project card → `projects` array in the script block.
- New dev log / reading note → `devPosts` / `readingPosts` arrays.
- "On the bench right now" → the `#now` section near the top.
Commit + push = deployed. Every update is a timestamped public artifact.
