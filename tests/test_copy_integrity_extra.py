#!/usr/bin/env python3
"""Review test for "no URL changed, no fact lost" (card a10d3d87, written by
the reviewer). It covers what tests/test_copy_integrity.py does not.

  1. MUTATION  tests/test_copy_integrity.py is not vacuous: when one link, one
               media file, one id, one code sample, one script or one number
               is removed from a page, its facts() comparison reports the loss.
  2. JSON      assets/blog-posts.json and assets/projects.json: the same
               entries in the same order as at the base ref; only title,
               ogTitle, excerpt and tagline changed (slug, url, date, tags,
               image stay).
  3. SITEMAP   sitemap.xml has the same <loc> URLs as at the base ref.
  4. FEED      feed.xml has the same item links, guids and dates.
  5. TOKENS    each {{ template }} token of the three portal emails is still
               there, the same number of times.
  6. ATTRS     each poster, srcset, action and og:image / canonical URL of the
               base ref is still on its page.

Base ref: HEAD, or STE_BASE=<ref>. Files come from `git show`; the working
tree is not touched.

Usage (from website/):  python3 tests/test_copy_integrity_extra.py
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT.parent / "apps"
BASE = os.environ.get("STE_BASE", "HEAD")
TEXT_KEYS = {"title", "ogTitle", "excerpt", "tagline"}

spec = importlib.util.spec_from_file_location("copy_integrity", ROOT / "tests" / "test_copy_integrity.py")
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


def show(repo: Path, rel: str) -> str:
    r = subprocess.run(["git", "-C", str(repo), "show", f"{BASE}:{rel}"], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"cannot read {rel} at {BASE}")
    return r.stdout


def lost(old_html: str, new_html: str) -> dict[str, set]:
    old, new = ci.facts(old_html), ci.facts(new_html)
    return {label: getattr(old, label) - getattr(new, label)
            for label in ("links", "media", "ids", "code", "scripts", "numbers")}


def main() -> int:
    failed = 0

    def check(ok: bool, label: str, detail: str = ""):
        nonlocal failed
        failed += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'}  {label}{(': ' + detail) if detail and not ok else ''}")

    # 1. MUTATION
    page = ('<html><body><h2 id="goal">The goal</h2><p>The file has 250,000 rows. '
            '<a href="/blog/x.html">Read the post</a>. Run <code>npm run build</code>.</p>'
            '<video><source src="/assets/a.webm"></video><img src="data:image/png;base64,AAAA">'
            '<script>let n = 1;</script></body></html>')
    mutations = {
        "links": page.replace('href="/blog/x.html"', 'href="/blog/y.html"'),
        "media": page.replace("/assets/a.webm", "/assets/b.webm"),
        "ids": page.replace(' id="goal"', ""),
        "code": page.replace("npm run build", "npm run test"),
        "scripts": page.replace("let n = 1;", "let n = 2;"),
        "numbers": page.replace("250,000", "many"),
    }
    check(not any(lost(page, page).values()), "MUTATION an identical page loses nothing")
    for label, mutated in mutations.items():
        check(bool(lost(page, mutated)[label]), f"MUTATION a changed item in '{label}' is reported")
    check(bool(lost(page, page.replace("data:image/png;base64,AAAA", "data:image/png;base64,BBBB"))["media"]),
          "MUTATION a changed data: image is reported")
    real = (ROOT / "blog" / "rheoserv-waumpaum.html").read_text(encoding="utf-8")
    first_video = re.search(r'<video[^>]*src="([^"]+)"', real)
    check(bool(first_video) and bool(lost(real, real.replace(first_video.group(1), "/x.webm"))["media"]),
          "MUTATION a removed video of the RheoServ post is reported")

    # 2. JSON
    for rel, key, ident in (("assets/blog-posts.json", "posts", "slug"), ("assets/projects.json", "projects", "name")):
        old, new = json.loads(show(ROOT, rel)), json.loads((ROOT / rel).read_text(encoding="utf-8"))
        check([i.get(ident) for i in old[key]] == [i.get(ident) for i in new[key]], f"JSON {rel}: same entries, same order")
        changed = set()
        for a, b in zip(old[key], new[key]):
            changed |= {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
        check(changed <= TEXT_KEYS, f"JSON {rel}: only text keys changed", str(sorted(changed - TEXT_KEYS)))
        rest_old = {k: v for k, v in old.items() if k != key}
        rest_new = {k: v for k, v in new.items() if k != key}
        check(rest_old == rest_new, f"JSON {rel}: the other top-level keys did not change")

    # 3. SITEMAP
    locs = lambda xml: re.findall(r"<loc>(.*?)</loc>", xml)
    check(locs(show(ROOT, "sitemap.xml")) == locs((ROOT / "sitemap.xml").read_text(encoding="utf-8")),
          "SITEMAP the same URLs")

    # 4. FEED
    def items(xml: str):
        return [(re.search(r"<link>(.*?)</link>", i).group(1), re.search(r"<guid[^>]*>(.*?)</guid>", i).group(1),
                 re.search(r"<pubDate>(.*?)</pubDate>", i).group(1)) for i in xml.split("<item>")[1:]]
    check(items(show(ROOT, "feed.xml")) == items((ROOT / "feed.xml").read_text(encoding="utf-8")),
          "FEED the same item links, guids and dates")

    # 5. TOKENS
    for name in ("confirmation.html", "invite.html", "magic-link.html"):
        tokens = lambda html: Counter(re.sub(r"\s+", "", t) for t in re.findall(r"\{\{.*?\}\}", html))
        old = tokens(show(APPS, f"brand/templates/{name}"))
        new = tokens((APPS / "brand" / "templates" / name).read_text(encoding="utf-8"))
        check(old == new and sum(old.values()) > 0, f"TOKENS {name}: {dict(old)}", f"now {dict(new)}")

    # 6. ATTRS
    pattern = re.compile(r'(?:poster|srcset|action)="([^"]+)"|<meta[^>]*"(?:og:image|twitter:image|og:url)"[^>]*content="([^"]+)"'
                         r'|<link[^>]*rel="(?:canonical|alternate|icon)"[^>]*href="([^"]+)"')
    grab = lambda html: {next(g for g in m.groups() if g) for m in pattern.finditer(html)}
    names = subprocess.run(["git", "-C", str(ROOT), "ls-tree", "--name-only", BASE, "blog/"],
                           capture_output=True, text=True).stdout.split()
    for rel in ["index.html", "manifesto.html", "404.html"] + [n for n in names if n.endswith(".html")]:
        gone = grab(show(ROOT, rel)) - grab((ROOT / rel).read_text(encoding="utf-8"))
        check(not gone, f"ATTRS {rel}", str(sorted(gone)))

    print(f"test_copy_integrity_extra: {failed} failed (base {BASE})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
