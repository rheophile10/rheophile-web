#!/usr/bin/env bash
# Rebuild all generated artifacts for rheophile.ca. The outputs are committed,
# so GitHub Pages still serves plain static files — this build runs locally.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/sync-blog-meta.py     # OG/Twitter meta + BlogPosting JSON-LD into posts
python3 scripts/prerender.py          # bake project/blog cards + tag chips into HTML
python3 scripts/generate-rss.py       # feed.xml
python3 scripts/generate-sitemap.py   # sitemap.xml
python3 scripts/normalize-head.py     # tailwind link + font links (strips analytics)

# Compiled Tailwind (scans HTML + blog-ui.js). Runs last so it sees final markup.
npx -y tailwindcss@3.4.17 \
  -c tailwind.config.js \
  -i scripts/tailwind.input.css \
  -o assets/tailwind.css --minify

echo "build complete."
