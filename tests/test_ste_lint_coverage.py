#!/usr/bin/env python3
"""Review tests for scripts/ste-lint.py (card a10d3d87, written by the reviewer).

The design test plan says: "On the pre-change tree it exits 1 with several
hundred errors." No delivered test proves that. This file does, and it also
covers text sources that tests/test_ste_lint.py does not sample.

  1. BASE     the copy at a git ref (default e99cc31, or STE_BASE=<ref>) fails the
              checker with several hundred errors, and each error rule fires.
              The files come from `git show`; the working tree is not touched.
  2. NOW      the working tree has zero errors.
  3. SOURCES  the checker reads svg <desc>, <figcaption>, alt text, a JSON
              excerpt, the feed description, a <div> text node, and the
              English prose of a page whose <html lang> is not English.
  4. AUDIT    words in the "Do not write" table of the profile (design doc §1,
              W5) that scripts/ste_words.py does not hold, and each use of
              such a word in the copy. Report only; --strict makes it an error.

Usage (from website/):  python3 tests/test_ste_lint_coverage.py [--strict]
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT.parent / "apps"
# e99cc31 is the last commit before the STE rewrite: the old copy lives there.
BASE = os.environ.get("STE_BASE", "e99cc31")
RULES = ("LEN", "CONTR", "SEMI", "DASH", "WORD", "TENSE")


def load(path: Path):
    spec = importlib.util.spec_from_file_location("ste_lint_" + path.parent.parent.name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def show(repo: Path, rel: str) -> str | None:
    r = subprocess.run(["git", "-C", str(repo), "show", f"{BASE}:{rel}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def base_tree(tmp: Path) -> Path:
    """The in-scope copy at BASE, with today's checker beside it."""
    site = tmp / "website"
    (site / "scripts").mkdir(parents=True)
    for name in ("ste-lint.py", "ste_words.py"):
        shutil.copy(ROOT / "scripts" / name, site / "scripts" / name)
    names = subprocess.run(["git", "-C", str(ROOT), "ls-tree", "--name-only", BASE, "blog/"],
                           capture_output=True, text=True).stdout.split()
    rels = ["index.html", "manifesto.html", "404.html", "feed.xml",
            "assets/projects.json", "assets/blog-posts.json"] + [n for n in names if n.endswith(".html")]
    for rel in rels:
        text = show(ROOT, rel)
        if text is not None:
            (site / rel).parent.mkdir(parents=True, exist_ok=True)
            (site / rel).write_text(text, encoding="utf-8")
    out = tmp / "apps" / "brand" / "templates"
    out.mkdir(parents=True)
    for name in ("confirmation.html", "invite.html", "magic-link.html"):
        text = show(APPS, f"brand/templates/{name}")
        if text is not None:
            (out / name).write_text(text, encoding="utf-8")
    return site


def count(lint) -> tuple[int, dict]:
    total, by_rule = 0, {}
    for f in lint.default_files():
        errors, _ = lint.lint(f)
        total += len(errors)
        for _, rule, _, _ in errors:
            by_rule[rule] = by_rule.get(rule, 0) + 1
    return total, by_rule


def rules_for(lint, name: str, text: str) -> set[str]:
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / name
        p.write_text(text, encoding="utf-8")
        errors, _ = lint.lint(p)
    return {rule for _, rule, _, _ in errors}


# The "Do not write" column of the W5 table in the profile.
W5_TABLE = ["allow", "enable", "permit", "need", "require", "should", "have to", "need to", "may", "might",
            "ensure", "verify", "via", "by way of", "since", "once", "whether", "which", "however", "within",
            "roughly", "big", "huge", "provide", "perform", "carry out", "utilize", "leverage", "prior to",
            "just", "simply", "really", "very", "actually", "basically", "whatever", "etc", "and so on",
            "obtain", "happen"]
# Table entries with an approved second meaning (over, under, about, around, offer, ship, like, as)
# need a part-of-speech model; they are not audited here.
FORMS = {"permit": r"permit(?:s|ted)?", "verify": r"verif(?:y|ies|ied)", "carry out": r"carr(?:y|ies|ied) out",
         "very": r"very", "by way of": r"by way of"}


def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    failed = 0

    def check(ok: bool, label: str):
        nonlocal failed
        failed += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'}  {label}")

    lint = load(ROOT / "scripts" / "ste-lint.py")

    with tempfile.TemporaryDirectory() as d:
        base = load(base_tree(Path(d)) / "scripts" / "ste-lint.py")
        total, by_rule = count(base)
    check(total >= 300, f"BASE {BASE}: {total} errors (several hundred expected) {by_rule}")
    for rule in RULES:
        check(by_rule.get(rule, 0) > 0, f"BASE rule {rule} fires on the old copy ({by_rule.get(rule, 0)})")

    total_now, by_now = count(lint)
    check(total_now == 0, f"NOW: {total_now} errors in the working tree {by_now or ''}")

    bad = "You don't own it."
    check("CONTR" in rules_for(lint, "a.html", f"<svg><desc>{bad}</desc></svg>"), "SOURCES svg <desc>")
    check("CONTR" in rules_for(lint, "a.html", f"<figure><figcaption>{bad}</figcaption></figure>"), "SOURCES <figcaption>")
    check("CONTR" in rules_for(lint, "a.html", f'<img src="x.png" alt="{bad}">'), "SOURCES alt text")
    check("CONTR" in rules_for(lint, "a.html", f"<div>{bad}</div>"), "SOURCES <div> text node")
    check("CONTR" in rules_for(lint, "a.html", f'<html lang="zh-Hant"><body><p>{bad}</p></body></html>'),
          "SOURCES English prose on a page with <html lang=zh-Hant>")
    check("CONTR" in rules_for(lint, "a.json", json.dumps({"posts": [{"title": "T", "excerpt": bad}]})),
          "SOURCES JSON excerpt")
    check("CONTR" in rules_for(lint, "a.json", json.dumps({"projects": [{"name": "n", "tagline": bad}]})),
          "SOURCES JSON tagline")
    check("CONTR" in rules_for(lint, "a.xml", f"<rss><channel><title>T</title><description>{bad}</description>"
                                                "<item><title>x</title></item></channel></rss>"),
          "SOURCES feed description")
    check(not rules_for(lint, "a.html", "<p>" + " ".join(["word"] * 24) + " {{ .Confirmation URL Token }}.</p>"),
          "SOURCES a {{ template }} token counts as one word")

    missing = [w for w in W5_TABLE if w not in lint.W.UNAPPROVED and w not in lint.W.UNAPPROVED_PHRASES]
    hits = []
    for f in lint.default_files():
        for b in lint.blocks_for(f):
            text = re.sub(r"\{\{.*?\}\}", " CODE ", b.text)
            for w in missing:
                for m in re.finditer(rf"(?<![\w-]){FORMS.get(w, re.escape(w))}(?![\w-])", text, re.I):
                    hits.append(f"{f.name}:{b.line} '{m.group(0)}' in \"{text[max(0, m.start() - 40):m.end() + 30]}\"")
    label = "AUDIT" if not strict else "AUDIT (strict)"
    print(f"{'ok  ' if not (missing or hits) else ('FAIL' if strict else 'note')}  {label}: "
          f"W5 table words not in ste_words.py: {missing or 'none'}")
    for h in hits:
        print(f"        {h}")
    if strict and (missing or hits):
        failed += 1

    print(f"test_ste_lint_coverage: {failed} failed; audit: {len(missing)} word(s) not in the checker, "
          f"{len(hits)} use(s) in the copy")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
