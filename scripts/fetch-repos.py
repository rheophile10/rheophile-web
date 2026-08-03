#!/usr/bin/env python3
"""Snapshot the public GitHub repos into assets/repos.json.

Feeds the unified search index (see generate-search.py) so that "search rheophile"
covers the code as well as the writing.

TWO RULES ABOUT WHAT GOES IN, because this file is served publicly at
rheophile.ca/assets/repos.json:

  * private repos are excluded, always. Their names and descriptions are not public
    and this file is;
  * forks are excluded by default. They are other people's projects and they bury
    the actual work in the results.

Network failure is NOT fatal. The existing snapshot is kept and the build carries on,
because a build that needs GitHub to be reachable is a build that breaks on a plane.
Run it deliberately to refresh:

  python3 scripts/fetch-repos.py            # refresh from GitHub
  python3 scripts/fetch-repos.py --offline  # keep whatever is on disk
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "repos.json"

FIELDS = "name,description,url,repositoryTopics,primaryLanguage,pushedAt,isPrivate,isFork,isArchived,stargazerCount"


def fetch() -> list[dict]:
    """Ask the gh CLI for the repo list. Raises if gh is missing or unauthenticated."""
    raw = subprocess.run(
        ["gh", "repo", "list", "rheophile10", "--limit", "200", "--json", FIELDS],
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    ).stdout
    return json.loads(raw)


def normalize(repos: list[dict]) -> list[dict]:
    out = []
    for r in repos:
        if r.get("isPrivate") or r.get("isFork"):
            continue
        topics = [
            t["topic"]["name"]
            for t in (r.get("repositoryTopics") or [])
            if isinstance(t, dict) and t.get("topic")
        ]
        lang = (r.get("primaryLanguage") or {}).get("name")
        out.append(
            {
                "name": r["name"],
                "url": r["url"],
                "description": (r.get("description") or "").strip(),
                "topics": topics,
                "language": lang,
                "pushedAt": (r.get("pushedAt") or "")[:10],
                "stars": r.get("stargazerCount", 0),
                "archived": bool(r.get("isArchived")),
            }
        )
    # Most recently pushed first — the order someone scanning the list actually wants.
    out.sort(key=lambda r: r["pushedAt"], reverse=True)
    return out


def main() -> int:
    offline = "--offline" in sys.argv
    if offline:
        if OUT.exists():
            print(f"repos.json — offline, kept {len(json.loads(OUT.read_text())['repos'])} repos")
            return 0
        print("repos.json — offline and no snapshot on disk; writing an empty one")
        OUT.write_text(json.dumps({"repos": []}, indent=2) + "\n", encoding="utf-8")
        return 0

    try:
        repos = normalize(fetch())
    except Exception as exc:  # gh missing, unauthenticated, offline, rate-limited
        if OUT.exists():
            kept = len(json.loads(OUT.read_text(encoding="utf-8"))["repos"])
            print(f"repos.json — refresh failed ({type(exc).__name__}), kept {kept} repos")
            return 0
        print(f"repos.json — refresh failed ({type(exc).__name__}) and no snapshot; writing empty")
        OUT.write_text(json.dumps({"repos": []}, indent=2) + "\n", encoding="utf-8")
        return 0

    OUT.write_text(json.dumps({"repos": repos}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"repos.json — {len(repos)} public repos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
