#!/usr/bin/env python3
"""Generate feed.xml (RSS 2.0) from assets/blog-posts.json.

Usage (from website/):
  python3 scripts/generate-rss.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "assets" / "blog-posts.json"
FEED_PATH = ROOT / "feed.xml"

SITE = "https://rheophile.ca"
FEED_URL = f"{SITE}/feed.xml"
TITLE = "rheophile.ca — dev log"
DESCRIPTION = (
    "Notes on building plastron and other reactive, offline-first tools in the open."
)
LANGUAGE = "en-ca"


def rfc822(date_str: str) -> str:
    """Turn 'YYYY-MM-DD' into an RFC-822 date at 00:00 UTC."""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return format_datetime(dt)


def build_item(post: dict) -> str:
    url = f"{SITE}{post['href']}"
    title = post.get("ogTitle") or post["title"]
    categories = "".join(
        f"    <category>{escape(tag)}</category>\n" for tag in post.get("tags", [])
    )
    return (
        "  <item>\n"
        f"    <title>{escape(title)}</title>\n"
        f"    <link>{escape(url)}</link>\n"
        f"    <guid isPermaLink=\"true\">{escape(url)}</guid>\n"
        f"    <pubDate>{rfc822(post['date'])}</pubDate>\n"
        f"    <description>{escape(post['excerpt'])}</description>\n"
        f"{categories}"
        "  </item>"
    )


def main() -> None:
    data = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    posts = sorted(
        data.get("posts", []), key=lambda p: p["date"], reverse=True
    )
    last_build = rfc822(posts[0]["date"]) if posts else format_datetime(
        datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    items = "\n".join(build_item(p) for p in posts)

    feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>{escape(TITLE)}</title>
  <link>{SITE}/blog/</link>
  <atom:link href="{FEED_URL}" rel="self" type="application/rss+xml" />
  <description>{escape(DESCRIPTION)}</description>
  <language>{LANGUAGE}</language>
  <lastBuildDate>{last_build}</lastBuildDate>
{items}
</channel>
</rss>
"""
    FEED_PATH.write_text(feed, encoding="utf-8")
    print(f"wrote {FEED_PATH.relative_to(ROOT)} — {len(posts)} items")


if __name__ == "__main__":
    main()
