#!/usr/bin/env python3
"""Self-test for scripts/ste-lint.py: each rule must catch a bad sample and
must accept a good sample.

Usage (from website/):  python3 tests/test_ste_lint.py
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ste_lint", ROOT / "scripts" / "ste-lint.py")
lint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lint)

LONG = " ".join(["word"] * 26) + "."

# (name, html, rule expected among the errors — or None if the sample must pass)
CASES = [
    ("LEN description, 26 words", f"<p>The {LONG}</p>", "LEN"),
    ("LEN description, 25 words", "<p>" + " ".join(["word"] * 25) + ".</p>", None),
    ("LEN procedure, 21 words", "<ol><li>" + " ".join(["word"] * 21) + ".</li></ol>", "LEN"),
    ("LEN procedure, 20 words", "<ol><li>" + " ".join(["word"] * 20) + ".</li></ol>", None),
    ("LEN data-ste=procedure", '<div data-ste="procedure"><p>' + " ".join(["word"] * 21) + ".</p></div>", "LEN"),
    ("PARA seven sentences", "<p>" + "The file opens. " * 7 + "</p>", "PARA"),
    ("PARA six sentences", "<p>" + "The file opens. " * 6 + "</p>", None),
    ("CONTR don't", "<p>You don't own it.</p>", "CONTR"),
    ("CONTR curly it’s", "<p>It’s a file.</p>", "CONTR"),
    ("CONTR possessive is fine", "<p>The user's file opens.</p>", None),
    ("SEMI", "<p>Open the file; read the data.</p>", "SEMI"),
    ("DASH aside", "<p>The file opens in the browser — no server is necessary — and shows the form.</p>", "DASH"),
    ("DASH term — definition label", "<li>Sheets — a view cel for each cell.</li>", None),
    ("DASH in a heading", "<h2>RheoServ Waumpaum — a credit-union core</h2>", None),
    ("WORD via", "<p>Send the file via email.</p>", "WORD"),
    ("WORD phrase in order to", "<p>Open the file in order to read it.</p>", "WORD"),
    ("WORD approved words", "<p>Send the file through email.</p>", None),
    ("WORD hyphenated technical name", "<p>The once-only key is a technical name.</p>", None),
    ("TENSE progressive", "<p>The server is running the code.</p>", "TENSE"),
    ("TENSE perfect", "<p>The coordinator has merged the files.</p>", "TENSE"),
    ("TENSE simple", "<p>The coordinator merged the files.</p>", None),
    ("skip: code is one word", "<p>Run <code>a; b; c don't via</code> now.</p>", None),
    ("skip: pre", "<pre>don't; via</pre>", None),
    ("skip: data-ste", '<blockquote data-ste="skip">We don\'t need no education; via.</blockquote>', None),
    ("skip: other language", '<p lang="zh">曳尾塗中; don\'t</p>', None),
    ("skip: generated region", "<!-- prerender:blog:start --><p>don't</p><!-- prerender:blog:end --><p>The file opens.</p>", None),
    ("meta description is checked", '<meta name="description" content="You don\'t own it.">', "CONTR"),
    ("svg text is checked", "<svg><text>Send via email</text></svg>", "WORD"),
    ("PARA a lower-case technical name starts a sentence", "<p>" + "The file opens. " * 6 + "cr-sqlite merges it.</p>", "PARA"),
    ("an abbreviation does not end a sentence", "<p>" + " ".join(["word"] * 13) + " Corp. " + " ".join(["word"] * 13) + ".</p>", "LEN"),
    ("a quoted question in a sentence does not end it",
     "<p>" + "The file opens. " * 5 + 'The question "Can Alice read this?" becomes a new question.</p>', None),
    ("parentheses count as a separate sentence",
     "<p>" + " ".join(["word"] * 20) + " (" + " ".join(["word"] * 10) + ").</p>", None),
]


def errors_for(html: str) -> set[str]:
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
    try:
        errors, _ = lint.lint(Path(f.name))
    finally:
        Path(f.name).unlink()
    return {rule for _, rule, _, _ in errors}


def main() -> int:
    failed = 0
    for name, html, expected in CASES:
        got = errors_for(html)
        ok = (expected in got) if expected else not got
        if not ok:
            failed += 1
        want = expected or "no error"
        print(f"{'ok  ' if ok else 'FAIL'}  {name}: expected {want}, got {sorted(got) or 'no error'}")

    # passive voice is a warning, never an error
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write("<p>The file is encrypted by the browser.</p>")
    errors, warnings = lint.lint(Path(f.name))
    Path(f.name).unlink()
    ok = not errors and any(rule == "PASSIVE" for _, rule, _, _ in warnings)
    failed += 0 if ok else 1
    print(f"{'ok  ' if ok else 'FAIL'}  PASSIVE is a warning only")

    print(f"test_ste_lint: {len(CASES) + 1} cases, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
