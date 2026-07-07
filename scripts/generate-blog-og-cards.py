#!/usr/bin/env python3
"""Render 1200×630 Open Graph cards for each entry in assets/blog-posts.json.

Usage (from website/):
  python3 scripts/generate-blog-og-cards.py

Requires Google Chrome at /usr/bin/google-chrome (headless screenshot).
Re-run whenever blog-posts.json changes.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "scripts" / "blog-og-card.html"
TEMPLATE_BANNER = ROOT / "scripts" / "blog-og-card-banner.html"
POSTS_JSON = ROOT / "assets" / "blog-posts.json"
OUT_DIR = ROOT / "assets" / "og"
CHROME = "/usr/bin/google-chrome"
SITE = "https://rheophile.ca"


def strip_title_emoji(title: str) -> str:
    # Keep CJK and Latin; drop trailing decorative emoji clusters.
    return re.sub(r"\s*[\U0001F300-\U0001FAFF\U00002600-\U000027BF]+\s*$", "", title).strip()


def card_emoji(post: dict) -> str:
    return post.get("emoji") or "🐸"


def pick_template(post: dict) -> str:
    if post.get("bannerImage") and TEMPLATE_BANNER.exists():
        return TEMPLATE_BANNER.read_text(encoding="utf-8")
    return TEMPLATE.read_text(encoding="utf-8")


def render_card(post: dict) -> str:
    template = pick_template(post)
    title = post.get("ogTitle") or strip_title_emoji(post["title"])
    tags = " · ".join(post.get("tags", []))
    html = (
        template.replace("{{EMOJI}}", card_emoji(post))
        .replace("{{DATE}}", post["date"])
        .replace("{{TITLE}}", title)
        .replace("{{EXCERPT}}", post["excerpt"])
        .replace("{{TAGS}}", tags)
    )
    banner_image = post.get("bannerImage")
    if banner_image:
        banner_path = ROOT / banner_image.lstrip("/")
        html = html.replace("{{BANNER_URI}}", banner_path.resolve().as_uri())
    return html


def screenshot(html: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        tmp = f.name
    try:
        subprocess.run(
            [
                CHROME,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                f"--window-size=1200,630",
                f"--screenshot={out}",
                Path(tmp).as_uri(),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        Path(tmp).unlink(missing_ok=True)


def write_jpeg(png_path: Path) -> Path:
    from PIL import Image

    jpg_path = png_path.with_suffix(".jpg")
    with Image.open(png_path) as img:
        img.convert("RGB").save(jpg_path, "JPEG", quality=92, optimize=True)
    return jpg_path


def main() -> None:
    data = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    posts = data.get("posts", [])
    updated = False

    for post in posts:
        slug = post["slug"]
        out = OUT_DIR / f"{slug}.png"
        html = render_card(post)
        screenshot(html, out)
        jpg = write_jpeg(out)
        og_png = f"{SITE}/assets/og/{slug}.png"
        og_jpg = f"{SITE}/assets/og/{slug}.jpg"
        if post.get("ogImage") != og_png:
            post["ogImage"] = og_png
            updated = True
        if post.get("ogImageJpg") != og_jpg:
            post["ogImageJpg"] = og_jpg
            updated = True
        print(f"wrote {out.relative_to(ROOT)} + {jpg.relative_to(ROOT)}")
        print(f"  og:image     → {og_png}")
        print(f"  twitter pref → {og_jpg}")

    if updated:
        POSTS_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"updated {POSTS_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()