#!/usr/bin/env python3
"""Build assets/search.json — one index covering the writing and the code.

Three sources, deliberately not three indexes:

  assets/blog-posts.json  the posts (title, excerpt, tags, date)
  assets/repos.json       every public repo, snapshotted from GitHub
  assets/projects.json    the curated few, with hand-written taglines and live URLs

A repo that also has a curated entry is ONE result, not two. The curated tagline wins
over the GitHub description — it was written for a reader rather than for a repo list —
and the live URL and emoji come along with it. Without that merge, searching "plastron"
would return the same thing twice and neither copy would be the good one.

Every entry is flattened to the same shape so a consumer never has to branch on kind:

  { kind, id, title, url, summary, tags[], date, extra{} }

plus a precomputed lowercase `text` blob, so matching is a substring test rather than a
per-field walk. That is what makes the file useful to something other than the search page —
fetch it, grep it, done:

  curl -s https://rheophile.ca/assets/search.json | jq '.entries[] | select(.text|test("sqlite"))'
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "search.json"

SITE = "https://rheophile.ca"


def load(name: str, key: str) -> list[dict]:
    path = ASSETS / name
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get(key, [])


def repo_slug(url: str) -> str:
    """github.com/owner/name -> name, lowercased, for matching against curated slugs."""
    return re.sub(r"/+$", "", (url or "")).rsplit("/", 1)[-1].lower()


def blob(*parts) -> str:
    words: list[str] = []
    for part in parts:
        if isinstance(part, (list, tuple)):
            words.extend(str(p) for p in part)
        elif part:
            words.append(str(part))
    return " ".join(words).lower()


def main() -> int:
    posts = load("blog-posts.json", "posts")
    repos = load("repos.json", "repos")
    projects = load("projects.json", "projects")

    by_slug = {repo_slug(p.get("repo", "")): p for p in projects if p.get("repo")}

    entries: list[dict] = []

    for post in posts:
        entries.append(
            {
                "kind": "post",
                "id": post["slug"],
                "title": post.get("ogTitle") or post.get("title", post["slug"]),
                "url": SITE + post["href"],
                "summary": (post.get("excerpt") or "").strip(),
                "tags": post.get("tags", []),
                "date": post.get("date", ""),
                "extra": {"emoji": post.get("emoji", ""), "shortTitle": post.get("title", "")},
                "text": blob(
                    post.get("title"), post.get("ogTitle"), post.get("excerpt"), post.get("tags"), post["slug"]
                ),
            }
        )

    for repo in repos:
        curated = by_slug.get(repo["name"].lower())
        summary = (curated.get("tagline") if curated else "") or repo.get("description", "")
        tags = list(dict.fromkeys([*(repo.get("topics") or []), *( [repo["language"]] if repo.get("language") else [])]))
        extra = {
            "language": repo.get("language"),
            "stars": repo.get("stars", 0),
            "archived": repo.get("archived", False),
        }
        if curated:
            extra["curated"] = True
            if curated.get("live"):
                extra["live"] = curated["live"]
            if curated.get("emoji"):
                extra["emoji"] = curated["emoji"]
        entries.append(
            {
                "kind": "repo",
                "id": repo["name"],
                "title": repo["name"],
                "url": repo["url"],
                "summary": summary.strip(),
                "tags": tags,
                "date": repo.get("pushedAt", ""),
                "extra": extra,
                "text": blob(repo["name"], summary, repo.get("description"), tags),
            }
        )

    # A curated project with no GitHub repo (or one that is private) would otherwise vanish.
    seen_repo_ids = {e["id"].lower() for e in entries if e["kind"] == "repo"}
    for project in projects:
        slug = repo_slug(project.get("repo", "")) or project.get("slug", "")
        if slug in seen_repo_ids:
            continue
        entries.append(
            {
                "kind": "repo",
                "id": project.get("slug", slug),
                "title": project.get("name", slug),
                "url": project.get("repo") or project.get("live", ""),
                "summary": (project.get("tagline") or "").strip(),
                "tags": [project["lang"]] if project.get("lang") else [],
                "date": "",
                "extra": {"curated": True, "emoji": project.get("emoji", ""), "live": project.get("live")},
                "text": blob(project.get("name"), project.get("tagline"), project.get("lang")),
            }
        )

    entries.sort(key=lambda e: (e["date"] or "0000-00-00"), reverse=True)

    index = {
        "site": SITE,
        "counts": {
            "posts": sum(1 for e in entries if e["kind"] == "post"),
            "repos": sum(1 for e in entries if e["kind"] == "repo"),
        },
        "entries": entries,
    }
    OUT.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"search.json — {index['counts']['posts']} posts + {index['counts']['repos']} repos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
