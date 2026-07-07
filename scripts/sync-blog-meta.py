#!/usr/bin/env python3
"""Inject Open Graph / Twitter meta from assets/blog-posts.json into blog HTML.

Usage (from website/):
  python3 scripts/sync-blog-meta.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "assets" / "blog-posts.json"
SITE = "https://rheophile.ca"
TWITTER_SITE = "@rheophile10"

META_START = "  <!-- rheophile:og:start -->"
META_END = "  <!-- rheophile:og:end -->"


def strip_title_emoji(title: str) -> str:
    return re.sub(r"\s*[\U0001F300-\U0001FAFF\U00002600-\U000027BF]+\s*$", "", title).strip()


def og_image_url(post: dict) -> str:
    return post.get("ogImageJpg") or post["ogImage"]


def build_meta(post: dict) -> str:
    slug = post["slug"]
    page_url = f"{SITE}{post['href']}"
    title = post.get("ogTitle") or strip_title_emoji(post["title"])
    description = post["excerpt"]
    image = og_image_url(post)
    image_alt = f"{title} — rheophile.ca dev log"
    image_type = "image/jpeg" if image.endswith(".jpg") else "image/png"

    lines = [
        META_START,
        f'  <link rel="canonical" href="{page_url}">',
        f'  <meta name="description" content="{description}">',
        '  <meta property="og:type" content="article">',
        f'  <meta property="og:site_name" content="rheophile.ca">',
        f'  <meta property="og:locale" content="en_CA">',
        f'  <meta property="og:url" content="{page_url}">',
        f'  <meta property="og:title" content="{title}">',
        f'  <meta property="og:description" content="{description}">',
        f'  <meta property="og:image" content="{image}">',
        f'  <meta property="og:image:secure_url" content="{image}">',
        f'  <meta property="og:image:type" content="{image_type}">',
        f'  <meta property="og:image:width" content="1200">',
        f'  <meta property="og:image:height" content="630">',
        f'  <meta property="og:image:alt" content="{image_alt}">',
        f'  <meta property="article:published_time" content="{post["date"]}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:site" content="{TWITTER_SITE}">',
        f'  <meta name="twitter:creator" content="{TWITTER_SITE}">',
        f'  <meta name="twitter:url" content="{page_url}">',
        f'  <meta name="twitter:title" content="{title}">',
        f'  <meta name="twitter:description" content="{description}">',
        f'  <meta name="twitter:image" content="{image}">',
        f'  <meta name="twitter:image:alt" content="{image_alt}">',
        '  <meta name="robots" content="max-image-preview:large">',
        META_END,
    ]
    return "\n".join(lines)


def strip_legacy_social_meta(html: str) -> str:
    patterns = [
        r"\s*<link rel=\"canonical\"[^>]*>\n?",
        r"\s*<meta name=\"description\"[^>]*>\n?",
        r"\s*<meta property=\"og:[^\"]+\"[^>]*>\n?",
        r"\s*<meta property=\"article:[^\"]+\"[^>]*>\n?",
        r"\s*<meta name=\"twitter:[^\"]+\"[^>]*>\n?",
        r"\s*<meta name=\"robots\" content=\"max-image-preview:large\"[^>]*>\n?",
    ]
    for pattern in patterns:
        html = re.sub(pattern, "", html)
    html = re.sub(
        re.escape(META_START) + r".*?" + re.escape(META_END) + r"\n?",
        "",
        html,
        flags=re.DOTALL,
    )
    html = re.sub(r"</title>\s*<!-- rheophile:og:start -->", "</title>", html)
    return html


def sync_post(post: dict) -> None:
    html_path = ROOT / post["href"].lstrip("/")
    html = html_path.read_text(encoding="utf-8")
    html = strip_legacy_social_meta(html)
    meta = build_meta(post)

    html = re.sub(
        r'(<meta name="viewport" content="width=device-width, initial-scale=1\.0">)\n',
        r"\1\n" + meta + "\n",
        html,
        count=1,
    )

    html_path.write_text(html, encoding="utf-8")
    print(f"synced {html_path.relative_to(ROOT)}")


def main() -> None:
    data = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    for post in data.get("posts", []):
        sync_post(post)


if __name__ == "__main__":
    main()