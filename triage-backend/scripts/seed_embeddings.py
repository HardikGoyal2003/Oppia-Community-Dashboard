#!/usr/bin/env python3
"""Seed the Firestore vector store with embeddings for EVERY Oppia issue (open + closed).

Uses the local sentence-transformers model, the same pipeline as the /seed
endpoint's _run_seed, and writes into the `issueEmbeddings` collection that
VectorService reads. ChromaDB is not involved.

Usage:
  .venv/bin/python scripts/seed_embeddings.py            # full ~10k sweep
  SEED_YEAR_START=2012 SEED_YEAR_END=2015 .venv/bin/python scripts/seed_embeddings.py  # range
  .venv/bin/python scripts/seed_embeddings.py --limit 200
  .venv/bin/python scripts/seed_embeddings.py --min-number 20000
"""
import os
import sys
import time
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import config  # noqa: E402
from embedding_service import EmbeddingService  # noqa: E402
from vector_service import VectorService  # noqa: E402
from classifier_service import infer_team  # noqa: E402


def _count_query(github_token: str, headers: dict, query: str):
    """Fetch total_count for a search query (per_page=1)."""
    resp = None
    for attempt in range(1, 4):
        try:
            resp = httpx.get(
                f"https://api.github.com/search/issues?q={query}&per_page=1",
                headers=headers, timeout=30,
            )
            resp.raise_for_status()
            return resp.json().get("total_count", 0)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                wait = attempt * 60
                print(f"  Rate limited on count, waiting {wait}s (attempt {attempt})...")
                time.sleep(wait)
                continue
        except httpx.HTTPError as e:
            print(f"  Network error counting query: {e}")
        return 0
    return 0


def fetch_all_issues(github_token: str, max_issues: int, min_number: int = 0):
    """Fetch every open+closed issue from oppia/oppia via GitHub search API.

    Search API caps at 1000 results/query, so we page per state+year, and
    sub-partition any year that nears the cap by month (e.g. closed/2015).
    """
    import calendar as _cal

    headers = {"Accept": "application/vnd.github.v3+json"}
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    all_issues = []
    seen = set()
    for state in ["open", "closed"]:
        for year in range(config.seed_year_start, config.seed_year_end + 1):
            if len(all_issues) >= max_issues:
                return all_issues

            year_query = quote(
                f"repo:{config.github_repo} state:{state} type:issue "
                f"created:{year}-01-01..{year}-12-31"
            )
            total = _count_query(github_token, headers, year_query)
            # Build windows: whole year, or by month if the year is near the cap.
            if total >= 900:
                windows = [
                    (
                        f"{state}/{year}-{m:02d}",
                        f"{year}-{m:02d}-01..{year}-{m:02d}-"
                        f"{_cal.monthrange(year, m)[1]}",
                    )
                    for m in range(1, 13)
                ]
            else:
                windows = [(f"{state}/{year}", f"{year}-01-01..{year}-12-31")]

            for label, date_range in windows:
                if len(all_issues) >= max_issues:
                    return all_issues
                query = quote(
                    f"repo:{config.github_repo} state:{state} type:issue "
                    f"created:{date_range}"
                )
                page = 1
                retries = 0
                while page <= 10 and retries < 3:
                    url = (
                        f"https://api.github.com/search/issues"
                        f"?q={query}&per_page=100&page={page}&sort=created&order=desc"
                    )
                    try:
                        resp = httpx.get(url, headers=headers, timeout=30)
                        resp.raise_for_status()
                        data = resp.json()
                        retries = 0
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 403:
                            retries += 1
                            wait = retries * 60
                            print(f"  Rate limited, waiting {wait}s (attempt {retries})...")
                            time.sleep(wait)
                            continue
                        if e.response.status_code == 422:
                            break
                        raise
                    except httpx.HTTPError as e:
                        print(f"  Network error for {label}: {e}")
                        break

                    items = data.get("items", [])
                    for item in items:
                        num = item["number"]
                        if num in seen or num < min_number:
                            continue
                        seen.add(num)
                        all_issues.append({
                            "number": num,
                            "title": item.get("title", ""),
                            "body": (item.get("body") or "")[:2000],
                            "labels": [l["name"] for l in item.get("labels", [])],
                            "state": item.get("state", "open"),
                        })
                    print(f"  {label} page {page}: {len(all_issues)} total")
                    if len(items) < 100:
                        break
                    page += 1
                time.sleep(2)  # be gentle with search rate limits
    return all_issues


def main():
    max_issues = 10000
    min_number = 0
    if "--limit" in sys.argv:
        max_issues = int(sys.argv[sys.argv.index("--limit") + 1])
    if "--min-number" in sys.argv:
        min_number = int(sys.argv[sys.argv.index("--min-number") + 1])

    print("Step 1: fetching ALL oppia issues (open + closed) from GitHub...")
    issues = fetch_all_issues(config.github_token, max_issues, min_number)
    issues.sort(key=lambda i: i["number"])
    print(f"Fetched {len(issues)} issues.\n")

    print("Step 2: loading embedding model...")
    embedder = EmbeddingService()
    embedder.load_model()
    if not embedder.is_loaded():
        print("Embedding model failed to load. Aborting.")
        sys.exit(1)
    print(f"Model dimension: {embedder.dimension}\n")

    print("Step 3: initializing Firestore vector store...")
    vector_store = VectorService()
    vector_store.initialize()
    existing = vector_store.count()
    print(f"Collection '{vector_store.collection_name}' currently has {existing} docs.\n")

    # Embed EVERY issue (open + closed). Labeled issues carry usable
    # labels/team for few-shot; unlabeled ones still serve similar-issue
    # context but are excluded from few-shot examples (no corrected_labels).
    print(f"Embedding {len(issues)} issues (labeled and unlabeled).")

    seeded = 0
    batch_size = 32
    for i in range(0, len(issues), batch_size):
        batch = issues[i: i + batch_size]
        texts = [f"{issue['title']}\n{issue['body'][:2000]}" for issue in batch]
        try:
            embeddings = embedder.embed_batch(texts)
        except Exception as e:
            print(f"  Batch embedding failed at {i}: {e}")
            continue

        for issue, embedding in zip(batch, embeddings):
            labels = issue["labels"]
            team = infer_team(labels, issue["title"]) if labels else ""
            try:
                vector_store.add_issue(
                    issue_number=issue["number"],
                    title=issue["title"],
                    embedding=embedding,
                    metadata={
                        "labels": labels[:10],
                        "team": team,
                        "state": "accepted",
                        "corrected_labels": labels[:10],
                        "corrected_team": team,
                        "github_state": issue["state"],
                    },
                )
                seeded += 1
            except Exception as e:
                print(f"  Failed to seed #{issue['number']}: {e}")

        if (i + batch_size) % 1000 == 0 or (i + batch_size) >= len(issues):
            print(f"  Progress: {seeded}/{len(issues)} seeded")

    print(f"\n=== Done: {seeded} issues embedded into '{vector_store.collection_name}'. ===")
    print(f"Collection now has {vector_store.count()} docs.")


if __name__ == "__main__":
    main()