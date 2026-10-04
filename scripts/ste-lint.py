#!/usr/bin/env python3
"""Check the site copy against the ASD-STE100 profile for rheophile.ca.

Usage (from website/):
  python3 scripts/ste-lint.py                 # all site copy; exit 1 on an error
  python3 scripts/ste-lint.py blog/x.html     # only the files you name
  python3 scripts/ste-lint.py --warnings      # also print warnings (passive voice, -ing)

Machine-checkable rules only (the profile is in the docs repo:
docs/rheophile/design/ste100-site-copy.md):
  LEN    sentence length: 20 words in a procedure, 25 words in a description
  PARA   a paragraph has a maximum of six sentences
  CONTR  no contractions
  SEMI   no semicolons
  DASH   no em-dash asides in a sentence ("term — definition" labels are permitted)
  WORD   unapproved words and phrases (scripts/ste_words.py)
  TENSE  no progressive or perfect tenses
  PASSIVE / ING   warnings only

Skipped text: script, style, pre, any element with data-ste="skip" or a
non-English lang, and the regions that the build generates from the JSON
files. Inline <code> and {{ template }} tokens count as one word.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.dont_write_bytecode = True  # no scripts/__pycache__ in the repo
ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("ste_words", Path(__file__).with_name("ste_words.py"))
W = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(W)

MAX_PROCEDURE = 20
MAX_DESCRIPTION = 25
MAX_PARAGRAPH = 6

SKIP_TAGS = {"script", "style", "pre", "template", "noscript", "textarea"}
TEXT_BLOCKS = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "figcaption", "td", "th",
               "summary", "blockquote", "dt", "dd", "title", "text", "desc", "label"}
INLINE = {"span", "strong", "em", "b", "i", "a", "code", "br", "sup", "sub", "small",
          "mark", "u", "kbd", "abbr", "time", "tspan", "wbr", "img"}
TITLE_KINDS = {"h1", "h2", "h3", "h4", "h5", "h6", "title", "text", "label", "attr-title"}
VOID = {"br", "img", "meta", "link", "input", "hr", "wbr", "source", "track", "path",
        "rect", "circle", "line", "polyline", "polygon", "ellipse", "use", "stop"}
META_NAMES = {"description", "og:description", "twitter:description", "og:title", "twitter:title"}
GENERATED = re.compile(r"^\s*(prerender:\w+|rheophile:og):(start|end)\s*$")


class Block:
    def __init__(self, kind: str, text: str, line: int, procedure: bool):
        self.kind, self.text, self.line, self.procedure = kind, text, line, procedure


class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[Block] = []
        self.stack: list[tuple[str, bool, bool]] = []  # (tag, skip, procedure)
        self.buf: list[str] = []
        self.buf_kind = "div"
        self.buf_line = 1
        self.generated = False
        self.ld_json = False
        self.ld_buf: list[str] = []

    # -- state helpers
    def skipping(self) -> bool:
        return self.generated or any(s for _, s, _ in self.stack)

    def procedure(self) -> bool:
        return any(p for _, _, p in self.stack)

    def text_block(self) -> str | None:
        for tag, _, _ in reversed(self.stack):
            if tag in TEXT_BLOCKS:
                return tag
        return None

    def flush(self):
        text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        if text:
            self.blocks.append(Block(self.buf_kind, text, self.buf_line, self.buf_proc))
        self.buf = []

    def start_buf(self):
        self.buf_kind = self.text_block() or "div"
        self.buf_line = self.getpos()[0]
        self.buf_proc = self.procedure()

    buf_proc = False

    # -- parser events
    def handle_comment(self, data):
        m = GENERATED.match(data)
        if m:
            self.flush()
            self.generated = m.group(2) == "start"

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            name = a.get("name") or a.get("property") or ""
            if name in META_NAMES and a.get("content") and not self.skipping():
                kind = "attr-title" if name.endswith("title") else "meta"
                self.blocks.append(Block(kind, a["content"], self.getpos()[0], False))
            return
        if not self.skipping():
            for attr in ("alt", "aria-label"):
                if a.get(attr):
                    self.blocks.append(Block("attr-title", a[attr], self.getpos()[0], False))
        if tag == "script" and a.get("type") == "application/ld+json" and not self.generated:
            self.ld_json, self.ld_buf = True, []
        lang = a.get("lang", "")
        skip = (tag in SKIP_TAGS or a.get("data-ste") == "skip"
                or (tag != "html" and lang and not lang.lower().startswith("en")))
        proc = tag == "ol" or a.get("data-ste") == "procedure"
        if tag == "code" and not self.skipping():
            self.buf.append(" CODE ")
            skip = True
        inline = tag in INLINE and not (tag == "a" and self.text_block() is None)
        if not inline:
            self.flush()
        if tag == "br":
            self.buf.append(" ")
        if tag not in VOID:
            self.stack.append((tag, skip, proc))
        if not inline:
            self.start_buf()

    def handle_endtag(self, tag):
        if tag == "script" and self.ld_json:
            self.ld_json = False
            try:
                self.ld_strings(json.loads("".join(self.ld_buf)))
            except json.JSONDecodeError:
                pass
        inline = tag in INLINE and not (tag == "a" and self.text_block() is None)
        if not inline:
            self.flush()
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if not inline:
            self.start_buf()

    def handle_data(self, data):
        if self.ld_json:
            self.ld_buf.append(data)
            return
        if self.skipping():
            return
        if not self.buf:
            self.start_buf()
        self.buf.append(data)

    def ld_strings(self, node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("description", "headline") and isinstance(v, str):
                    self.blocks.append(Block("meta" if k == "description" else "attr-title", v, 0, False))
                else:
                    self.ld_strings(v)
        elif isinstance(node, list):
            for v in node:
                self.ld_strings(v)


# ---------------------------------------------------------------- rules

# A sentence can start with a lower-case technical name (cr-sqlite, localRbac).
SENT_END = re.compile(r"[.!?][\"”’)\]]*\s+(?=[\"“‘(\[]?[A-Za-z0-9一-鿿])")
CONTRACTION = re.compile(
    r"\b(\w+n['’]t|\w+['’](?:re|ve|ll|d|m)|(?:it|that|there|here|what|who|where|let|he|she)['’]s)\b", re.I)
BE = r"(?:am|is|are|was|were|be|been|being)"
PROGRESSIVE = re.compile(rf"\b{BE}\s+(?:not\s+)?(?:\w+ly\s+)?(\w+ing)\b", re.I)
PERFECT = re.compile(r"\b(?:has|have|had)\s+(?:not\s+)?(?:\w+ly\s+)?(\w+)\b", re.I)
PASSIVE = re.compile(rf"\b{BE}\s+(?:not\s+)?(?:\w+ly\s+)?(\w+)\b", re.I)
ING_LEAD = re.compile(r"\b(?:by|for|without|before|after|when|while|of|from)\s+(\w+ing)\b|^(\w+ing)\b", re.I)
WORD = re.compile(r"[A-Za-z][A-Za-z'’-]*")


def sentences(text: str) -> list[str]:
    parts, start = [], 0
    for m in SENT_END.finditer(text):
        head = text[start:m.end()].strip()
        last = head.split()[-1].lower() if head.split() else ""
        if last in W.ABBREVIATIONS or re.fullmatch(r"\d+\.", last):
            continue
        # a quoted question in the middle of a sentence: "Can Alice read this?" becomes ...
        if re.search(r"[\"”’]", m.group(0)) and text[m.end():m.end() + 1].islower():
            continue
        parts.append(head)
        start = m.end()
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def count_words(sentence: str) -> int:
    return sum(1 for tok in sentence.split() if re.search(r"[A-Za-z0-9一-鿿]", tok))


def is_pp(word: str) -> bool:
    w = word.lower()
    return w in W.IRREGULAR_PP or (w.endswith("ed") and len(w) > 4)


def check_block(b: Block, errors: list, warnings: list):
    text = re.sub(r"\{\{.*?\}\}", " CODE ", b.text)
    title_like = b.kind in TITLE_KINDS
    limit = MAX_PROCEDURE if b.procedure else MAX_DESCRIPTION

    # S6: text in parentheses counts as a separate sentence
    asides = re.findall(r"\(([^()]*)\)", text)
    main = re.sub(r"\s*\([^()]*\)", "", text)
    sents = sentences(main)

    if not title_like and len(sents) > MAX_PARAGRAPH:
        errors.append((b, "PARA", f"{len(sents)} sentences (maximum {MAX_PARAGRAPH})", text))

    for s in sents + asides:
        n = count_words(s)
        if n > limit:
            kind = "procedure" if b.procedure else "description"
            errors.append((b, "LEN", f"{n} words (maximum {limit} in a {kind})", s))
        if not title_like:
            dashes = len(re.findall(r"\s[—–]\s", s))
            if dashes:
                before = re.split(r"\s[—–]\s", s)[0]
                if dashes > 1 or count_words(before) > 6:
                    errors.append((b, "DASH", "em-dash aside in a sentence: use two sentences or a list", s))
        if ";" in s:
            errors.append((b, "SEMI", "semicolon: use two sentences", s))
        for m in CONTRACTION.finditer(s):
            errors.append((b, "CONTR", f"contraction '{m.group(0)}'", s))
        low = s.lower()
        for phrase, alt in W.UNAPPROVED_PHRASES.items():
            if re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", low):
                errors.append((b, "WORD", f"'{phrase}' → {alt}", s))
        for m in WORD.finditer(s):
            w = m.group(0)
            # a hyphenated compound is a technical name or one unit; check plain words only
            if "-" in w or (m.start() > 0 and s[m.start() - 1] in "-/.#@_"):
                continue
            if m.end() < len(s) and s[m.end()] in "-/_@" :
                continue
            if w == "May":  # the month
                continue
            alt = W.UNAPPROVED.get(w.lower())
            if alt:
                errors.append((b, "WORD", f"'{w}' → {alt}", s))
        for m in PROGRESSIVE.finditer(s):
            if m.group(1).lower() not in W.ING_OK:
                errors.append((b, "TENSE", f"progressive tense '{m.group(0)}': use the simple tense", s))
        for m in PERFECT.finditer(s):
            if is_pp(m.group(1)):
                errors.append((b, "TENSE", f"perfect tense '{m.group(0)}': use the simple past", s))
        for m in PASSIVE.finditer(s):
            if is_pp(m.group(1)):
                warnings.append((b, "PASSIVE", f"'{m.group(0)}': use the active voice if you know the agent", s))
        for m in ING_LEAD.finditer(s):
            w = (m.group(1) or m.group(2)).lower()
            if w not in W.ING_OK:
                warnings.append((b, "ING", f"'{m.group(0)}': -ing form (permitted only as a technical name)", s))


# ---------------------------------------------------------------- sources

def html_blocks(path: Path) -> list[Block]:
    p = Extract()
    p.feed(path.read_text(encoding="utf-8"))
    p.flush()
    return p.blocks


def json_blocks(path: Path) -> list[Block]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for item in data.get("posts", []) + data.get("projects", []):
        for key in ("title", "ogTitle"):  # a project name is a technical name: not checked
            if item.get(key):
                out.append(Block("attr-title", item[key], 0, False))
        for key in ("excerpt", "tagline"):
            if item.get(key):
                out.append(Block("meta", item[key], 0, False))
    return out


def feed_blocks(path: Path) -> list[Block]:
    head = path.read_text(encoding="utf-8").split("<item>")[0]
    out = []
    for tag, kind in (("title", "attr-title"), ("description", "meta")):
        m = re.search(rf"<{tag}>(.*?)</{tag}>", head, re.S)
        if m:
            out.append(Block(kind, m.group(1), 0, False))
    return out


def default_files() -> list[Path]:
    files = [ROOT / "index.html", ROOT / "manifesto.html", ROOT / "404.html"]
    files += sorted((ROOT / "blog").glob("*.html"))
    # the pages of the apps (chat, games, plastron): their static text only
    files += sorted(f for f in ROOT.glob("*/index.html") if f.parent.name not in ("apps", "blog", "reference"))
    files += sorted(f for f in ROOT.glob("*/*/index.html") if f.parts[-3] not in ("apps", "reference", "assets"))
    files += [ROOT / "assets" / "projects.json", ROOT / "assets" / "blog-posts.json", ROOT / "feed.xml"]
    files += sorted((ROOT.parent / "apps" / "brand" / "templates").glob("*.html"))
    return [f for f in files if f.exists()]


def blocks_for(path: Path) -> list[Block]:
    if path.suffix == ".json":
        return json_blocks(path)
    if path.suffix == ".xml":
        return feed_blocks(path)
    return html_blocks(path)


def lint(path: Path) -> tuple[list, list]:
    errors, warnings = [], []
    for b in blocks_for(path):
        check_block(b, errors, warnings)
    return errors, warnings


def show(path: Path, items: list, label: str):
    try:
        name = path.resolve().relative_to(ROOT)
    except ValueError:
        name = path
    for b, rule, detail, sentence in items:
        excerpt = sentence if len(sentence) <= 110 else sentence[:107] + "..."
        where = f"{name}:{b.line}" if b.line else f"{name}"
        print(f"{where}: {label} [{rule}] {detail}\n    “{excerpt}”")


def main(argv: list[str]) -> int:
    show_warnings = "--warnings" in argv
    names = [a for a in argv if not a.startswith("--")]
    files = [Path(n) if Path(n).is_absolute() else Path.cwd() / n for n in names] or default_files()
    total_e = total_w = 0
    for f in files:
        errors, warnings = lint(f)
        show(f, errors, "error")
        if show_warnings:
            show(f, warnings, "warning")
        total_e += len(errors)
        total_w += len(warnings)
    print(f"ste-lint: {len(files)} files, {total_e} errors, {total_w} warnings"
          + ("" if show_warnings or not total_w else " (--warnings to list them)"))
    return 1 if total_e else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
