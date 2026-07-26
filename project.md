# Project: make rheophile.ca a first-class knowledge base for LLM agents

**For a separate agent.** Scope is *this repo only* (the rheophile.ca static site). Do **not**
touch the TypeScript/JavaScript train-rules project or its Python datalayer — those live
elsewhere and are owned by other agents.

## The one constraint that shapes everything

rheophile.ca is a **static GitHub Pages site** — served as-is from the repo root on `master`,
**no server, no CI build** (there's a *local* `scripts/build.sh` whose outputs are committed;
see `DEPLOY.md`). So:

- **Agents are fetch-only.** An agent (like the one that wrote this) does `GET <url>` and reads
  the returned text; it does **not** run your client-side JavaScript. A client-side SQLite/search
  UI is invisible to it. "Query with URL params" only works if the responses are **pre-generated
  static files** — a static host cannot run a query server-side.
- Therefore: **optimize for agents by generating static, machine-readable text artifacts at
  stable URLs.** Layer any fancy client-side search on top as a *human* affordance.

## Content model (already in place)

- Posts are HTML in `blog/*.html`, driven by `assets/blog-posts.json`
  (`{posts:[{slug,href,date,tags,emoji,title,ogTitle,excerpt,ogImage,ogImageJpg}]}`).
- `assets/blog-ui.js` renders the grids/related client-side from that JSON.
- `scripts/build.sh` runs, in order: `sync-blog-meta → prerender → generate-rss →
  generate-sitemap → normalize-head → Tailwind compile`. Add new generators to `scripts/` and
  wire them into this pipeline; keep outputs committed.

## Deliverables (in priority order)

1. **`llms.txt` + `llms-full.txt`** at the site root (the [llmstxt.org](https://llmstxt.org)
   convention — the site already ships `plastron.ca/llms.txt`). `llms.txt` = a curated map
   (site blurb + one line and a link per post, pointing at each post's clean markdown).
   `llms-full.txt` = every post's clean text concatenated. Generate both in `build.sh` from
   `blog-posts.json` + post bodies. **This is the highest-leverage item** — one fetch = the whole KB.

2. **Clean per-post Markdown** at `/blog/<slug>.md` — strip nav/OG/styling, emit just the
   article as Markdown. Far cleaner for agents than HTML→markdown of a styled page, and what
   `llms.txt` links to.

3. **Chunked `search-index.json`** — one entry per `<h2>` **section**:
   `{url, anchor, post_title, section_title, text}`. Requires giving every `<h2>` a stable `id`
   (add a slug-id step to `prerender`/a new generator). This is what makes **sections individually
   addressable** — a hit points at `/blog/<slug>.md#<section>` (or a per-section fragment file if
   you want maximal granularity).

4. **A static `/search.html?q=…`** page — reads the query param, searches `search-index.json`
   in-browser, renders section-level results linking into the posts. This is the human-facing
   search; the *param* is client-side, the *content* it points at is static (so agents can fetch
   those targets directly).

5. **(Optional, advanced)** a static `content.sqlite` queried client-side over **HTTP range
   requests** (only fetch the pages a query touches) — see
   [`sql.js-httpvfs`](https://github.com/phiresky/sql.js-httpvfs) and this repo's dev-log post
   `blog/wa-sqlite-idb-demand-paged.html` (+ the demo repo
   [`rheophile10/wa-sqlite-idb-demo`](https://github.com/rheophile10/wa-sqlite-idb-demo)). Nice
   dogfooding, but **not** required for the agent-KB — items 1–3 are.

## Guardrails

- Don't break `build.sh`; it must stay idempotent and produce committed static output.
- `robots.txt` currently `Disallow: /apps/` — make sure `llms.txt`, `/blog/*.md`, and
  `search-index.json` are crawlable, and add `llms.txt` to the sitemap or reference it from `robots.txt`.
- Every post body is already real DOM (not JS-rendered), which is good for HTML→markdown fallback — keep it that way.

## Acceptance

- An agent can fetch **one URL** (`/llms.txt` or `/llms-full.txt`) and get the whole knowledge base.
- Each post is available as clean Markdown at a predictable URL.
- A section can be retrieved on its own (stable `#anchor` + chunked index).
- `build.sh` regenerates all of the above deterministically from `blog-posts.json` + post bodies.
