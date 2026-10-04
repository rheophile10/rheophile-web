#!/usr/bin/env python3
"""The STE rewrite must not lose a link, a media file, a code sample, a
script, an element id, or a number.

Compares each file in the working tree with the same file at a git ref
(default HEAD, or STE_BASE=<ref>) and fails if something that was there
before is not there now.

Usage (from website/):
  python3 tests/test_copy_integrity.py              # all pages + the email templates
  python3 tests/test_copy_integrity.py blog/x.html  # only the files you name
"""
from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("STE_BASE", "HEAD")
GENERATED = re.compile(r"<!-- (prerender:\w+):start -->.*?<!-- \1:end -->", re.S)


class Facts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.media, self.ids = set(), set(), set()
        self.code, self.scripts, self.numbers = set(), set(), set()
        self.stack: list[str] = []
        self.capture: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("href"):
            self.links.add(a["href"])
        if a.get("src"):
            src = a["src"]
            if src.startswith("data:"):
                src = "data:" + hashlib.sha256(src.encode()).hexdigest()[:16]
            self.media.add(f"{tag} {src}")
        if a.get("id"):
            self.ids.add(a["id"])
        if tag in ("code", "pre", "script") and self.capture is None:
            if not (tag == "script" and a.get("type") == "application/ld+json"):
                self.capture = []
                self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.capture is not None and self.stack and self.stack[-1] == tag:
            text = re.sub(r"\s+", " ", "".join(self.capture)).strip()
            if text:
                (self.scripts if tag == "script" else self.code).add(text)
            self.capture = None
            self.stack.pop()

    def handle_data(self, data):
        if self.capture is not None:
            self.capture.append(data)
        else:
            self.numbers.update(re.findall(r"\d+(?:[.,]\d+)*", data))


def facts(html: str) -> Facts:
    f = Facts()
    f.feed(GENERATED.sub("", html))
    return f


def at_base(path: Path) -> str | None:
    r = subprocess.run(["git", "-C", str(path.parent), "show", f"{BASE}:./{path.name}"],
                       capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def default_files() -> list[Path]:
    files = [ROOT / "index.html", ROOT / "manifesto.html", ROOT / "404.html"]
    files += sorted((ROOT / "blog").glob("*.html"))
    files += sorted((ROOT.parent / "apps" / "brand" / "templates").glob("*.html"))
    return files


def main(argv: list[str]) -> int:
    files = [Path.cwd() / a for a in argv] or default_files()
    failures = 0
    for path in files:
        old_html = at_base(path)
        if old_html is None:
            print(f"skip  {path.name} (not in {BASE})")
            continue
        old, new = facts(old_html), facts(path.read_text(encoding="utf-8"))
        lost = []
        for label in ("links", "media", "ids", "code", "scripts", "numbers"):
            for item in sorted(getattr(old, label) - getattr(new, label)):
                lost.append(f"{label}: {item[:140]}")
        if lost:
            failures += 1
            print(f"FAIL  {path.parent.name}/{path.name}: {len(lost)} item(s) lost")
            for item in lost:
                print(f"        {item}")
        else:
            print(f"ok    {path.parent.name}/{path.name}")
    print(f"copy-integrity: {len(files)} files, {failures} failed (base {BASE})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
