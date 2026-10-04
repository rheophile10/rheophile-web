#!/usr/bin/env python3
"""Review test for the STE diagrams (card a10d3d87, written by the reviewer).

The story spec only asks for "N or more" diagrams on a page and looks at the
rendered size. This test reads the HTML and holds each diagram to the design
doc (docs/rheophile/design/ste100-site-copy.md §2) and to STANDARDS.md.

CONTRACT (an error):
  - the number of diagrams on each page is the delivered number (14 in all),
    and the pages with no planned diagram have none;
  - each diagram is an inline <svg role="img"> in <figure class="ste-diagram">
    with a <title>, a <desc>, and a <figcaption> that starts "Figure N.";
  - aria-labelledby names the ids of that title and that desc;
  - no script, no external file, no <image> or <foreignObject> in the svg;
  - viewBox width is 640 or less, width="100%", and the max-width of the
    figure equals the viewBox width;
  - each title, desc, label and caption passes scripts/ste-lint.py.

CONVENTIONS (design §2; a note, or an error with --strict):
  - text is 14 units or larger;
  - a box holds a maximum of six words.

Usage (from website/):  python3 tests/test_ste_diagrams.py [--strict]
"""
from __future__ import annotations

import importlib.util
import re
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent

EXPECTED = {
    "index.html": 1,
    "manifesto.html": 1,
    "blog/localrbac-crypto-rbac.html": 4,
    "blog/offline-forms.html": 2,
    "blog/offline-hris-juarez.html": 2,
    "blog/rheoserv-waumpaum.html": 2,
    "blog/chaosedgesteg-plastron.html": 2,
    "404.html": 0,
    "blog/index.html": 0,
    "blog/yiwei-tuzhong.html": 0,
}
FIGURE = re.compile(r'<figure[^>]*class="[^"]*\bste-diagram\b[^"]*"[^>]*>.*?</figure>', re.S)


def attr(tag: str, name: str, default=None):
    m = re.search(rf'(?<![\w-]){name}="([^"]*)"', tag)
    return m.group(1) if m else default


def plain(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def words(text: str) -> int:
    return sum(1 for w in text.split() if re.search(r"\w", w))


def lint_errors(fragment: str) -> list[str]:
    spec = importlib.util.spec_from_file_location("ste_lint", ROOT / "scripts" / "ste-lint.py")
    lint = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lint)
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "figure.html"
        p.write_text(fragment, encoding="utf-8")
        errors, _ = lint.lint(p)
    return [f"{rule}: {detail}" for _, rule, detail, _ in errors]


def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    errors: list[str] = []
    notes: list[str] = []
    total = 0
    for page, expected in EXPECTED.items():
        html = (ROOT / page).read_text(encoding="utf-8")
        figures = FIGURE.findall(html)
        total += len(figures)
        if len(figures) != expected:
            errors.append(f"{page}: {len(figures)} diagrams, expected {expected}")
        for n, fig in enumerate(figures, 1):
            where = f"{page} figure {n}"
            fig_tag = re.match(r"<figure[^>]*>", fig).group(0)
            svgs = re.findall(r"<svg[^>]*>", fig)
            if len(svgs) != 1:
                errors.append(f"{where}: {len(svgs)} <svg> elements")
                continue
            svg = svgs[0]
            title = re.search(r'<title id="([^"]+)">(.*?)</title>', fig, re.S)
            desc = re.search(r'<desc id="([^"]+)">(.*?)</desc>', fig, re.S)
            caption = re.search(r"<figcaption[^>]*>(.*?)</figcaption>", fig, re.S)
            if attr(svg, "role") != "img":
                errors.append(f'{where}: no role="img"')
            if not (title and plain(title.group(2))):
                errors.append(f"{where}: no <title>")
            if not (desc and words(plain(desc.group(2))) >= 8):
                errors.append(f"{where}: no <desc> that describes the diagram")
            if title and desc and attr(svg, "aria-labelledby", "").split() != [title.group(1), desc.group(1)]:
                errors.append(f"{where}: aria-labelledby does not name the title and the desc")
            if not (caption and re.match(rf"Figure {n}\. \S", plain(caption.group(1)))):
                errors.append(f'{where}: the caption does not start "Figure {n}."')
            for bad in ("<script", "<image", "<foreignObject", "xlink:href", 'href="http'):
                if bad in fig:
                    errors.append(f"{where}: {bad} in the figure")
            box = [float(v) for v in attr(svg, "viewBox", "0 0 0 0").split()]
            if not 0 < box[2] <= 640:
                errors.append(f"{where}: viewBox width {box[2]:g} (maximum 640)")
            if attr(svg, "width") != "100%":
                errors.append(f'{where}: the svg does not have width="100%"')
            max_width = re.search(r"max-width:\s*([\d.]+)px", attr(fig_tag, "style", ""))
            if not (max_width and float(max_width.group(1)) == box[2]):
                errors.append(f"{where}: max-width of the figure is not the viewBox width ({box[2]:g}px)")
            for e in lint_errors(fig):
                errors.append(f"{where}: ste-lint {e}")

            # conventions
            base = float(attr(svg, "font-size", "16"))
            texts = [(float(attr(t, "x", "0")), float(attr(t, "y", "0")), float(attr(t, "font-size", base)), plain(body))
                     for t, body in re.findall(r"(<text[^>]*>)(.*?)</text>", fig, re.S)]
            small = [t for t in texts if t[2] < 14]
            if small:
                notes.append(f"{where}: {len(small)} label(s) smaller than 14 units, for example "
                             f"\"{small[0][3]}\" ({small[0][2]:g})")
            rects = [(float(attr(r, "x", "0")), float(attr(r, "y", "0")), float(attr(r, "width", "0")),
                      float(attr(r, "height", "0"))) for r in re.findall(r"<rect[^>]*>", fig)]
            for (x, y, w, h) in rects:
                if any(rx > x and ry > y and rx + rw < x + w and ry + rh < y + h for (rx, ry, rw, rh) in rects):
                    continue  # a group frame around other boxes
                inside = [t for t in texts if x <= t[0] <= x + w and y <= t[1] <= y + h]
                count = sum(words(t[3]) for t in inside)
                if count > 6:
                    notes.append(f"{where}: a box holds {count} words: \"{' / '.join(t[3] for t in inside)}\"")

    for e in errors:
        print(f"FAIL  {e}")
    for n in notes:
        print(f"{'FAIL' if strict else 'note'}  convention: {n}")
    failed = len(errors) + (len(notes) if strict else 0)
    print(f"test_ste_diagrams: {total} diagrams on {len(EXPECTED)} pages, {len(errors)} contract error(s), "
          f"{len(notes)} convention deviation(s){' (strict)' if strict else ''}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
