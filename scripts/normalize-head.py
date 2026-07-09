#!/usr/bin/env python3
"""Apply site-wide <head> conventions to every content page (idempotent):

  1. Swap the Tailwind Play CDN <script> for the compiled /assets/tailwind.css.
  2. Move the render-blocking @import Google-Fonts URL out of <style> into
     preconnect + <link rel="stylesheet"> in the head.
  3. Strip any analytics <script> (analytics is off for now).

Run it after adding a new page/post so its head matches the rest of the site.

Usage (from website/):
  python3 scripts/normalize-head.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [ROOT / "index.html", ROOT / "404.html", ROOT / "blog" / "index.html"] + sorted(
    (ROOT / "blog").glob("*.html")
)

CDN = '<script src="https://cdn.tailwindcss.com"></script>'
TW_LINK = '<link rel="stylesheet" href="/assets/tailwind.css">'


def swap_tailwind(html: str) -> str:
    return html.replace(CDN, TW_LINK)


def migrate_fonts(html: str) -> str:
    # Already migrated?
    if re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2', html):
        return html
    m = re.search(r'[ \t]*@import url\((\'|")(https://fonts\.googleapis\.com/css2[^\'"]+)(\'|")\);\n', html)
    if not m:
        return html
    url = m.group(2)
    html = html[: m.start()] + html[m.end():]  # drop the @import line
    links = (
        '  <link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'  <link rel="stylesheet" href="{url}">\n'
    )
    anchor = "  " + TW_LINK + "\n"
    if anchor in html:
        return html.replace(anchor, links + anchor, 1)
    # Fallback: before the icon link
    return re.sub(r'(  <link rel="icon")', links + r"\1", html, count=1)


def strip_analytics(html: str) -> str:
    # Analytics is off for now — remove any previously-injected analytics tag.
    return re.sub(r'[ \t]*<script[^>]*\bplausible\.io\b[^>]*></script>\n', "", html)


def main() -> None:
    for path in FILES:
        html = path.read_text(encoding="utf-8")
        before = html
        html = swap_tailwind(html)
        html = migrate_fonts(html)
        html = strip_analytics(html)
        if html != before:
            path.write_text(html, encoding="utf-8")
            print(f"normalized {path.relative_to(ROOT)}")
        else:
            print(f"unchanged  {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
