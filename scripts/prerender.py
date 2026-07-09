#!/usr/bin/env python3
"""Bake the JS-rendered grids into static HTML for crawlers / no-JS visitors.

Injects project cards, blog cards, and tag chips between the
`<!-- prerender:NAME:start -->` / `<!-- prerender:NAME:end -->` markers in
index.html and blog/index.html.

IMPORTANT: the markup here must mirror assets/blog-ui.js. blog-ui.js is still
the runtime renderer (it re-renders identical content on load and wires the
tag-filter handlers); this snapshot is what non-JS clients see. If you change
a card's markup in blog-ui.js, change it here too.

Usage (from website/):
  python3 scripts/prerender.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "assets" / "blog-posts.json"
PROJECTS_JSON = ROOT / "assets" / "projects.json"
INDEX = ROOT / "index.html"
BLOG_INDEX = ROOT / "blog" / "index.html"


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def project_card(p: dict) -> str:
    links = []
    if p.get("repo"):
        links.append(
            f'<a href="{esc(p["repo"])}" target="_blank" rel="noopener" '
            'class="text-teal-400 hover:text-teal-300 transition">Source '
            '<span aria-hidden="true">↗</span></a>'
        )
    if p.get("live"):
        links.append(
            f'<a href="{esc(p["live"])}" target="_blank" rel="noopener" '
            'class="text-teal-400 hover:text-teal-300 transition">Live '
            '<span aria-hidden="true">↗</span></a>'
        )
    if p.get("blog"):
        links.append(
            f'<a href="{esc(p["blog"])}" '
            'class="text-teal-400 hover:text-teal-300 transition">Read '
            '<span aria-hidden="true">→</span></a>'
        )
    return (
        '<article class="project-card rounded-3xl border border-white/10 bg-zinc-900/60 p-6 flex flex-col">'
        '<div class="flex items-center justify-between gap-3">'
        '<div class="flex items-center gap-2.5 min-w-0">'
        f'<span class="text-2xl leading-none" aria-hidden="true">{esc(p.get("emoji", "📦"))}</span>'
        f'<h4 class="font-semibold tracking-tight text-lg truncate">{esc(p["name"])}</h4>'
        "</div>"
        f'<span class="shrink-0 text-[10px] uppercase tracking-widest text-zinc-400 px-2 py-0.5 rounded-full border border-white/10">{esc(p.get("lang", ""))}</span>'
        "</div>"
        f'<p class="mt-3 text-sm text-zinc-400 leading-relaxed flex-1">{esc(p.get("tagline", ""))}</p>'
        '<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">'
        + "".join(links)
        + "</div></article>"
    )


def post_card(post: dict, heading: str) -> str:
    tags = " · ".join(post.get("tags", []))
    return (
        '<article class="post-card group block rounded-3xl border border-white/10 bg-zinc-900/70 p-6">'
        '<div class="flex justify-between items-baseline text-xs">'
        f'<time datetime="{esc(post["date"])}" class="text-teal-400 font-medium">{esc(post["date"])}</time>'
        f'<span class="text-zinc-600 group-hover:text-zinc-500">{esc(tags)}</span>'
        "</div>"
        f'<{heading} class="mt-2.5 text-xl tracking-tighter font-semibold leading-tight">'
        f'<a href="{esc(post["href"])}" class="stretched-link no-underline text-inherit group-hover:text-teal-400 transition">{esc(post["title"])}</a>'
        f"</{heading}>"
        f'<p class="mt-3 text-sm text-zinc-400 line-clamp-3">{esc(post["excerpt"])}</p>'
        '<div class="mt-5 text-xs text-teal-400 flex items-center gap-1">'
        'Read note <span aria-hidden="true" class="transition group-hover:translate-x-0.5">→</span>'
        "</div></article>"
    )


def tag_chip(tag: str, active: bool) -> str:
    label = tag or "All"
    text = f"#{label}" if tag else label
    cls = "px-3 py-1 rounded-full text-xs font-medium border transition-colors " + (
        "bg-teal-500 text-zinc-950 border-teal-500"
        if active
        else "bg-white/5 text-zinc-300 border-white/10 hover:border-teal-500/50 hover:text-white"
    )
    return (
        f'<button type="button" data-tag="{esc(tag)}" aria-pressed="{"true" if active else "false"}" '
        f'class="{cls}">{esc(text)}</button>'
    )


def replace_block(html: str, name: str, inner: str) -> str:
    pattern = re.compile(
        r"(<!-- prerender:" + re.escape(name) + r":start -->).*?(<!-- prerender:" + re.escape(name) + r":end -->)",
        re.DOTALL,
    )
    if not pattern.search(html):
        raise SystemExit(f"marker prerender:{name} not found")
    return pattern.sub(lambda m: m.group(1) + inner + m.group(2), html)


def main() -> None:
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8")).get("posts", [])
    projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8")).get("projects", [])

    tags = sorted({t for p in posts for t in p.get("tags", [])}, key=str.lower)

    projects_html = "".join(project_card(p) for p in projects if not p.get("featured"))
    home_posts_html = "".join(post_card(p, "h3") for p in posts)
    index_posts_html = "".join(post_card(p, "h2") for p in posts)
    tags_html = tag_chip("", True) + "".join(tag_chip(t, False) for t in tags)

    index = INDEX.read_text(encoding="utf-8")
    index = replace_block(index, "projects", projects_html)
    index = replace_block(index, "blog", home_posts_html)
    INDEX.write_text(index, encoding="utf-8")
    print(f"prerendered index.html — {len([p for p in projects if not p.get('featured')])} projects, {len(posts)} posts")

    blog = BLOG_INDEX.read_text(encoding="utf-8")
    blog = replace_block(blog, "tags", tags_html)
    blog = replace_block(blog, "blogindex", index_posts_html)
    BLOG_INDEX.write_text(blog, encoding="utf-8")
    print(f"prerendered blog/index.html — {len(tags)} tags, {len(posts)} posts")


if __name__ == "__main__":
    main()
