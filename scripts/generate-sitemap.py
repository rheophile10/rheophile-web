#!/usr/bin/env python3
"""Generate sitemap.xml from assets/blog-posts.json plus the static pages.

Usage (from website/):
  python3 scripts/generate-sitemap.py
"""
from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "assets" / "blog-posts.json"
SITEMAP_PATH = ROOT / "sitemap.xml"
SITE = "https://rheophile.ca"


def url_entry(loc: str, lastmod: str | None, priority: str) -> str:
    parts = [f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    parts.append(f"    <priority>{priority}</priority>")
    body = "\n".join(parts)
    return f"  <url>\n{body}\n  </url>"


def main() -> None:
    data = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    posts = sorted(data.get("posts", []), key=lambda p: p["date"], reverse=True)
    newest = posts[0]["date"] if posts else None

    entries = [
        url_entry(f"{SITE}/", newest, "1.0"),
        url_entry(f"{SITE}/manifesto.html", None, "0.9"),
        url_entry(f"{SITE}/blog/", newest, "0.8"),
    ]
    for post in posts:
        entries.append(url_entry(f"{SITE}{post['href']}", post["date"], "0.7"))

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    SITEMAP_PATH.write_text(sitemap, encoding="utf-8")
    print(f"wrote {SITEMAP_PATH.relative_to(ROOT)} — {len(posts) + 2} urls")


if __name__ == "__main__":
    main()
