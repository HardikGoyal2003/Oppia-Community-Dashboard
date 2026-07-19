"""
Seed ChromaDB with labeled Oppia issues from GitHub.

This script fetches closed issues with labels from oppia/oppia,
embeds them, and stores them in ChromaDB for few-shot learning.

Usage:
    python scripts/seed_chromadb.py [--max-issues 10000] [--github-token TOKEN]

Requirements:
    - Set GITHUB_TOKEN in .env or pass via --github-token
    - ChromaDB and embedding model must be initialized
"""

import os
import sys
import json
import time
import logging
import argparse

import httpx
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chroma_service import ChromaService
from embedding_service import EmbeddingService

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Labels we care about for triage
TRIAGE_LABELS = {
    "bug", "enhancement", "feature", "documentation", "good first issue",
    "impact-high", "impact-medium", "impact-low", "CI breakage",
    "translation", "accessibility", "performance",
}


def fetch_labeled_issues(
    github_token: str,
    max_issues: int = 10000,
    per_page: int = 100,
) -> list[dict]:
    """Fetch closed issues with labels from oppia/oppia via GitHub REST API.

    Uses search API to find issues that have at least one of our triage labels.
    """
    all_issues = []
    page = 1
    headers = {"Accept": "application/vnd.github.v3+json"}
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    # Search for closed issues with labels (most likely to have correct labels)
    label_query = " OR ".join(f"label:{l}" for l in TRIAGE_LABELS)
    query = f"repo:oppia/oppia+state:closed+type:issue+{label_query}"

    logger.info(f"Fetching up to {max_issues} labeled issues from GitHub...")

    with httpx.Client(timeout=30) as client:
        while len(all_issues) < max_issues:
            url = (
                f"https://api.github.com/search/issues"
                f"?q={query}&per_page={per_page}&page={page}&sort=updated&order=desc"
            )

            try:
                resp = client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    logger.warning("Rate limited. Waiting 60s...")
                    time.sleep(60)
                    continue
                raise

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                labels = [l["name"] for l in item.get("labels", [])]
                # Only include issues with at least one triage label
                triage_labels = [l for l in labels if l in TRIAGE_LABELS]
                if not triage_labels:
                    continue

                all_issues.append({
                    "number": item["number"],
                    "title": item["title"],
                    "body": (item.get("body") or "")[:2000],
                    "labels": labels,
                    "triage_labels": triage_labels,
                    "state": item.get("state", "closed"),
                })

            logger.info(
                f"  Page {page}: fetched {len(items)} issues "
                f"({len(all_issues)} total with triage labels)"
            )

            if len(items) < per_page:
                break

            page += 1
            time.sleep(1)  # Respect rate limits

    logger.info(f"Total issues fetched: {len(all_issues)}")
    return all_issues[:max_issues]


def infer_team(labels: list[str]) -> str:
    """Infer team from labels (best effort)."""
    if "translation" in labels:
        return "LEAP"
    if "documentation" in labels:
        return "Developer Workflow"
    if "CI breakage" in labels:
        return "Developer Workflow"
    return "CORE"


def seed_chromadb(
    issues: list[dict],
    chroma: ChromaService,
    embedder: EmbeddingService,
):
    """Embed issues and store them in ChromaDB."""
    logger.info(f"Seeding {len(issues)} issues into ChromaDB...")

    batch_size = 32
    seeded = 0

    for i in range(0, len(issues), batch_size):
        batch = issues[i : i + batch_size]

        # Embed batch
        texts = [f"{issue['title']}\n{issue['body']}" for issue in batch]
        try:
            embeddings = embedder._model.encode(
                texts, normalize_embeddings=True
            ).tolist()
        except Exception as e:
            logger.warning(f"Batch embedding failed at {i}: {e}. Skipping batch.")
            continue

        # Store in ChromaDB
        for issue, embedding in zip(batch, embeddings):
            try:
                team = infer_team(issue["triage_labels"])
                chroma.add_issue(
                    issue_number=issue["number"],
                    title=issue["title"],
                    embedding=embedding,
                    metadata={
                        "labels": issue["triage_labels"],
                        "team": team,
                        "state": "accepted",  # These are known-good labels
                        "corrected_labels": json.dumps(issue["triage_labels"]),
                        "corrected_team": team,
                    },
                )
                seeded += 1
            except Exception as e:
                logger.warning(f"Failed to seed #{issue['number']}: {e}")

        if (i + batch_size) % 200 == 0:
            logger.info(f"  Progress: {seeded}/{len(issues)} seeded")

    logger.info(f"Seeding complete: {seeded} issues stored in ChromaDB")
    return seeded


def main():
    parser = argparse.ArgumentParser(description="Seed ChromaDB with labeled Oppia issues")
    parser.add_argument("--max-issues", type=int, default=10000, help="Max issues to fetch")
    parser.add_argument("--github-token", type=str, default=None, help="GitHub token")
    args = parser.parse_args()

    github_token = args.github_token or os.getenv("GITHUB_TOKEN", "")
    if not github_token:
        logger.error("No GitHub token provided. Set GITHUB_TOKEN in .env or use --github-token")
        sys.exit(1)

    # Initialize services
    chroma = ChromaService()
    embedder = EmbeddingService()

    try:
        embedder.load_model()
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        sys.exit(1)

    try:
        chroma.initialize()
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB: {e}")
        sys.exit(1)

    # Fetch issues
    issues = fetch_labeled_issues(github_token, max_issues=args.max_issues)

    if not issues:
        logger.warning("No issues found. Exiting.")
        sys.exit(0)

    # Seed ChromaDB
    seeded = seed_chromadb(issues, chroma, embedder)

    logger.info(f"Done! {seeded} issues seeded into ChromaDB for few-shot learning.")


if __name__ == "__main__":
    main()
