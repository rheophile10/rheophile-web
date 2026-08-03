#!/usr/bin/env bash
# Regenerate the unified search index and the CSS the search page needs.
#
# Separate from build.sh on purpose. build.sh currently aborts at its first step:
# sync-blog-meta.py and prerender.py both expect the hand-written post format that the
# sqlite-cms migration (13054cd) replaced, so under `set -e` nothing after them runs —
# including the search steps and Tailwind. Until those two are retired or taught the new
# format, this is the way to keep search current.
#
# It stays wired into build.sh as well, so it does the right thing once that is fixed.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/fetch-repos.py "$@"    # assets/repos.json  (pass --offline to skip GitHub)
python3 scripts/generate-search.py     # assets/search.json

# search.html is in the Tailwind content globs, so its classes need a compile to exist.
npx -y tailwindcss@3.4.17 \
  -c tailwind.config.js \
  -i scripts/tailwind.input.css \
  -o assets/tailwind.css --minify

echo "search index built."
