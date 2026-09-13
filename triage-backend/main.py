"""
AI-Assisted Issue Triage Backend

FastAPI server that handles:
- ChromaDB vector storage for issue embeddings
- Semantic search for similar issues
- LLM-powered triage predictions with few-shot learning
- Feedback storage for continuous model improvement
- GitHub webhook ingestion
"""

import hmac
import json
import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from chroma_service import ChromaService
from embedding_service import EmbeddingService
from llm_service import LLMService
from classifier_service import infer_team
from config import config

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TRIAGE_API_KEY = config.triage_api_key
GITHUB_WEBHOOK_SECRET = config.github_webhook_secret
MAX_BATCH_SIZE = config.max_batch_size

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: Optional[str] = Security(_api_key_header)):
    """Reject requests without a valid X-API-Key header.

    If TRIAGE_API_KEY is unset, auth is disabled (local dev only) and a
    warning is logged so this is never silent in production.
    """
    if not TRIAGE_API_KEY:
        logger.warning(
            "TRIAGE_API_KEY is not set — API auth is DISABLED. "
            "Set it in .env before deploying."
        )
        return
    if not api_key or not hmac.compare_digest(api_key, TRIAGE_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

chroma = ChromaService()
embedder = EmbeddingService()
llm = LLMService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AI Triage Backend...")
    try:
        embedder.load_model()
        logger.info("Embedding model loaded.")
    except Exception as e:
        # Do NOT fall back to mock embeddings — predictions would be garbage.
        logger.error(f"Could not load embedding model: {e}")
        logger.error("Triage endpoints will return errors until this is fixed.")
    try:
        chroma.initialize()
        logger.info("ChromaDB initialized.")

        # Guard against embedding-model/DB dimension mismatch: querying a
        # collection seeded with a different model silently returns garbage.
        if embedder.is_loaded() and chroma.count() > 0:
            try:
                peek = chroma.collection.peek(limit=1)
                stored = peek.get("embeddings")
                stored_dim = len(stored[0]) if stored is not None and len(stored) > 0 else None
                if stored_dim and embedder.dimension and stored_dim != embedder.dimension:
                    raise RuntimeError(
                        f"Embedding dimension mismatch: ChromaDB was seeded with "
                        f"{stored_dim}-dim vectors but model "
                        f"'{embedder.model_name}' produces {embedder.dimension}-dim. "
                        f"Fix EMBEDDING_MODEL in .env or re-seed the database."
                    )
            except RuntimeError:
                raise
            except Exception as e:
                logger.warning(f"Could not verify embedding dimensions: {e}")
    except Exception as e:
        logger.error(f"Could not initialize ChromaDB: {e}")
        raise
    yield
    logger.info("Shutting down AI Triage Backend.")


app = FastAPI(title="Oppia AI Issue Triage", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ────────────────────────────────────────────────────────────────

class IssueInput(BaseModel):
    issueNumber: int
    issueTitle: str
    issueUrl: str
    issueBody: Optional[str] = ""
    labels: list[str] = []


class TriageRequest(BaseModel):
    issue: IssueInput


class FeedbackEntry(BaseModel):
    issueNumber: int
    issueId: str
    predictionAccuracy: float
    reviewStatus: str  # "accepted" | "edited" | "rejected"
    reviewer: str
    changes: list[dict]
    reviewerNotes: str = ""
    correctedLabels: Optional[list[str]] = None
    correctedTeam: Optional[str] = None


class TriageResponse(BaseModel):
    issueNumber: int
    labels: list[str]
    newLabels: list[str]
    team: str
    repository: str
    cuj: str
    goodFirstIssue: bool
    priority: str
    severity: str
    confidenceScore: float
    explanation: str
    similarIssues: list[dict]


# ─── Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "oppia-ai-triage", "version": "0.2.0"}


@app.post("/triage", response_model=TriageResponse)
async def triage_issue(request: TriageRequest, _=Security(require_api_key)):
    """Run AI triage on a single issue with the LLM as sole predictor.

    Pipeline:
    1. Embed the issue text
    2. Retrieve similar historical issues + few-shot examples from ChromaDB
       (CONTEXT only — no kNN voting; the LLM makes every decision)
    3. LLM predicts labels/team/priority from the issue content + context
    4. Compute newLabels (labels to ADD, excluding existing ones)
    5. Store embedding + prediction WITHOUT overwriting seeded ground truth
    """
    issue = request.issue
    result = await _triage_one(
        issue_number=issue.issueNumber,
        title=issue.issueTitle,
        body=issue.issueBody or "",
        existing_labels=issue.labels or [],
    )
    return TriageResponse(**result)


async def _triage_one(
    issue_number: int,
    title: str,
    body: str,
    existing_labels: list[str],
) -> dict:
    """Shared triage pipeline used by /triage, /batch-triage and the webhook.

    All blocking work (embedding, LLM HTTP call) runs in a worker thread so
    the event loop is never starved.
    """
    logger.info(f"Triaging issue #{issue_number}: {title}")

    # 1. Generate embedding (CPU-bound → worker thread).
    #    Truncate the body to match how seeded issues were embedded.
    issue_text = f"{title}\n{body[:2000]}"
    embedding = await asyncio.to_thread(embedder.embed, issue_text)

    # 2. Retrieve similar historical issues (CONTEXT only — the LLM decides,
    #    there is no kNN voting). Prefer reviewer-verified neighbors so the
    #    model isn't influenced by our own unverified pending predictions.
    similar_issues = await asyncio.to_thread(chroma.search, embedding, 6)
    verified = [
        s for s in similar_issues
        if s.get("metadata", {}).get("state") in ("accepted", "edited")
    ]
    reference_issues = verified if verified else similar_issues

    # 3. Search for few-shot examples (accepted/edited issues with corrections)
    few_shot_examples = chroma.search_for_few_shot(embedding, n_results=5)

    # 4. Build context from few-shot examples + similar issues
    context = _build_context(
        similar_issues=reference_issues[:5],
        few_shot_examples=few_shot_examples,
    )

    # 5. Ask the LLM to predict (blocking HTTP → worker thread).
    llm_prediction = await asyncio.to_thread(
        llm.predict, title, body, context, existing_labels
    )

    # 6. The LLM is the sole predictor — no merge step.
    prediction = llm_prediction

    # 7. Compute newLabels: labels to ADD, excluding existing ones and
    #    workflow-only labels that should never be suggested (e.g. "triage
    #    needed" is removed as part of the triage flow, never added).
    workflow_labels = {"triage needed"}
    all_predicted = [
        l for l in prediction.get("labels", []) if l.lower() not in workflow_labels
    ]
    prediction["labels"] = all_predicted
    new_labels = [l for l in all_predicted if l not in existing_labels]
    prediction["newLabels"] = new_labels

    # 8. Store embedding in ChromaDB — never overwrite verified ground truth.
    chroma.add_prediction(
        issue_number=issue_number,
        title=title,
        embedding=embedding,
        metadata={
            "labels": prediction.get("labels", []),
            "team": _normalize_team(prediction.get("team", "CORE")),
            "priority": prediction.get("priority", ""),
            "severity": prediction.get("severity", ""),
            "cuj": prediction.get("cuj", ""),
            "repository": prediction.get("repository", ""),
            "goodFirstIssue": prediction.get("goodFirstIssue", False),
            "state": "pending",
        },
    )

    return {
        "issueNumber": issue_number,
        "labels": prediction.get("labels", ["bug"]),
        "newLabels": prediction.get("newLabels", []),
        "team": _normalize_team(prediction.get("team", "CORE")),
        "repository": prediction.get("repository", "oppia/oppia"),
        "cuj": prediction.get("cuj", "Learner Experience"),
        "goodFirstIssue": prediction.get("goodFirstIssue", False),
        "priority": prediction.get("priority", "medium"),
        "severity": prediction.get("severity", "minor"),
        "confidenceScore": prediction.get("confidenceScore", 70.0),
        "explanation": prediction.get("explanation", ""),
        "similarIssues": [
            {
                "number": s["number"],
                "title": s["title"],
                "score": round((1 - s.get("distance", 1.0)) * 100, 1),
            }
            for s in reference_issues[:5]
        ],
    }


@app.post("/feedback")
async def store_feedback(feedback: FeedbackEntry, _=Security(require_api_key)):
    """Store reviewer feedback and update ChromaDB for continuous learning.

    This is the core of the learning loop:
    - When a reviewer accepts/edits/rejects, we update ChromaDB metadata
    - Future few-shot searches will use corrected labels as examples
    - The model improves over time without retraining
    """
    logger.info(
        f"Feedback for issue #{feedback.issueNumber}: "
        f"{feedback.reviewStatus} by {feedback.reviewer} "
        f"(accuracy: {feedback.predictionAccuracy}%)"
    )
    if feedback.reviewerNotes:
        logger.info(f"  Reviewer notes: {feedback.reviewerNotes}")

    # Update ChromaDB with corrected labels so future few-shot examples are accurate
    chroma.update_feedback(
        issue_number=feedback.issueNumber,
        review_status=feedback.reviewStatus,
        corrected_labels=feedback.correctedLabels,
        corrected_team=feedback.correctedTeam,
    )

    return {"status": "stored", "learning_loop": "updated"}


@app.post("/webhook/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive GitHub issue webhook (HMAC-verified) and trigger triage."""
    raw_body = await request.body()

    # Verify the GitHub webhook signature (X-Hub-Signature-256).
    if GITHUB_WEBHOOK_SECRET:
        signature = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(
            GITHUB_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning(
            "GITHUB_WEBHOOK_SECRET is not set — webhook signature "
            "verification is DISABLED. Set it before deploying."
        )

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action")
    issue_data = payload.get("issue")

    if action not in ("opened", "reopened") or not isinstance(issue_data, dict):
        return {"status": "ignored", "reason": "Not a new issue event."}

    try:
        issue = IssueInput(
            issueNumber=issue_data["number"],
            issueTitle=issue_data["title"],
            issueUrl=issue_data["html_url"],
            issueBody=issue_data.get("body") or "",
            labels=[
                l.get("name", "")
                for l in issue_data.get("labels", [])
                if isinstance(l, dict)
            ],
        )
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Malformed issue payload: {e}")

    background_tasks.add_task(triage_and_store, TriageRequest(issue=issue))

    return {"status": "processing", "issueNumber": issue.issueNumber}


@app.get("/stats")
async def get_stats():
    """Return ChromaDB stats for monitoring the learning loop."""
    return {
        "total_issues_in_chromadb": chroma.count(),
        "status": "ok",
    }


# ─── Helpers ──────────────────────────────────────────────────────────────

def _build_context(
    similar_issues: list[dict],
    few_shot_examples: list[dict] = None,
) -> str:
    """Build context for the LLM prompt (CONTEXT ONLY — no votes).

    Includes:
    - Few-shot examples from reviewer-verified triage decisions
    - Similar issues for reference
    """
    parts = []

    # Few-shot examples from reviewer-verified triage decisions
    if few_shot_examples:
        parts.append("Here are examples of correctly triaged issues (verified by human reviewers):")
        for i, issue in enumerate(few_shot_examples, 1):
            meta = issue.get("metadata", {})
            labels = meta.get("corrected_labels") or meta.get("labels", [])
            if isinstance(labels, str):
                try:
                    labels = json.loads(labels)
                except (json.JSONDecodeError, TypeError):
                    labels = [labels] if labels else []
            team = meta.get("corrected_team") or meta.get("team", "unknown")
            label_str = ", ".join(labels) if labels else "none"
            parts.append(
                f"Example {i}: \"{issue.get('title', 'Unknown')}\" "
                f"→ labels: [{label_str}], team: {team}"
            )
        parts.append("")

    # Similar issues for additional context
    if similar_issues:
        parts.append("Here are similar historical issues for reference:")
        for i, issue in enumerate(similar_issues[:5], 1):
            meta = issue.get("metadata", {})
            labels = meta.get("labels", [])
            if isinstance(labels, str):
                try:
                    labels = json.loads(labels)
                except (json.JSONDecodeError, TypeError):
                    labels = [labels] if labels else []
            label_str = ", ".join(labels) if labels else "none"
            parts.append(
                f"{i}. #{issue.get('number', '?')} - {issue.get('title', 'Unknown')} "
                f"[Labels: {label_str}]"
            )

    return "\n".join(parts) if parts else "No similar historical issues found."


def _normalize_team(team: str) -> str:
    """Ensure team is one of the valid values, mapping old names."""
    if team in config.valid_teams:
        return team
    mapped = config.team_map.get(team.lower(), "CORE")
    if team != mapped:
        logger.warning(f"Normalized team '{team}' -> '{mapped}'")
    return mapped

async def triage_and_store(request: TriageRequest):
    """Run triage and store results (called in background)."""
    try:
        issue = request.issue
        result = await _triage_one(
            issue_number=issue.issueNumber,
            title=issue.issueTitle,
            body=issue.issueBody or "",
            existing_labels=issue.labels or [],
        )
        logger.info(f"Triage complete for #{result['issueNumber']}")
    except Exception as e:
        logger.error(f"Triage failed for #{request.issue.issueNumber}: {e}")


class SeedRequest(BaseModel):
    max_issues: int = 10000
    github_token: Optional[str] = None


@app.post("/seed")
async def seed_chromadb(
    req: SeedRequest, background_tasks: BackgroundTasks, _=Security(require_api_key)
):
    """Seed ChromaDB with ALL Oppia issues for few-shot learning.

    This runs in the background since it takes several minutes (~10k issues).
    """
    # Only use the server-configured token — never accept caller tokens
    # beyond basic use, and require auth (above) to trigger this at all.
    github_token = req.github_token or config.github_token
    if not github_token:
        raise HTTPException(status_code=400, detail="GitHub token required")

    background_tasks.add_task(_run_seed, github_token, req.max_issues)

    return {
        "status": "started",
        "message": f"Seeding up to {req.max_issues} issues in background. Check /stats for progress.",
    }


async def _run_seed(github_token: str, max_issues: int):
    """Background task to seed ChromaDB with ALL Oppia issues (open + closed).

    GitHub search API caps at 1000 results per query, so we split by year
    to fetch all ~10k issues.
    """
    import httpx as _httpx
    import asyncio

    logger.info(f"Starting ChromaDB seed with up to {max_issues} issues...")

    all_issues = []
    seen_numbers = set()
    headers = {"Accept": "application/vnd.github.v3+json"}
    # Support both classic (ghp_) and fine-grained (github_pat_) tokens.
    if github_token and github_token != "your_github_token":
        headers["Authorization"] = f"token {github_token}"

    # Split by state and year to stay under 1000 per query
    queries = []
    for state in ["open", "closed"]:
        for year in range(2016, 2027):
            queries.append(f"repo:oppia/oppia+state:{state}+type:issue+created:{year}-01-01..{year}-12-31")

    try:
        async with _httpx.AsyncClient(timeout=30) as client:
            for query in queries:
                if len(all_issues) >= max_issues:
                    break

                page = 1
                retries = 0
                while page <= 10 and retries < 3:
                    url = (
                        f"https://api.github.com/search/issues"
                        f"?q={query}&per_page=100&page={page}&sort=created&order=desc"
                    )
                    data = None
                    try:
                        resp = await client.get(url, headers=headers)
                        resp.raise_for_status()
                        data = resp.json()
                        retries = 0
                    except _httpx.HTTPStatusError as e:
                        if e.response.status_code == 403:
                            retries += 1
                            wait = 60 * retries
                            logger.warning(f"Rate limited, waiting {wait}s (attempt {retries})...")
                            await asyncio.sleep(wait)
                            continue
                        if e.response.status_code == 422:
                            break
                        logger.warning(f"GitHub error for query {query}: {e}")
                        break
                    except _httpx.HTTPError as e:
                        logger.warning(f"Network error for query {query}: {e}")
                        break

                    if data is None:
                        break

                    items = data.get("items", [])
                    if not items:
                        break

                    for item in items:
                        num = item["number"]
                        if num in seen_numbers:
                            continue
                        seen_numbers.add(num)
                        labels = [l["name"] for l in item.get("labels", [])]
                        all_issues.append({
                            "number": num,
                            "title": item["title"],
                            "body": (item.get("body") or "")[:2000],
                            "labels": labels,
                            "state": item.get("state", "open"),
                        })

                    if page == 1:
                        total = data.get("total_count", 0)
                        logger.info(f"  {query.split('+')[1]}+{query.split('+')[2]}: {total} total, fetching...")

                    if len(items) < 100:
                        break
                    page += 1

                # Small delay between queries to avoid rate limits
                await asyncio.sleep(2)

    except Exception as e:
        logger.error(f"Failed to fetch issues: {e}")
        return

    logger.info(f"Fetched {len(all_issues)} total issues. Embedding and storing...")

    # Filter to issues with at least one label (more useful for training)
    issues_with_labels = [i for i in all_issues if i["labels"]]
    logger.info(f"Issues with labels: {len(issues_with_labels)} / {len(all_issues)}")

    try:
        # Reuse the already-loaded global embedder (avoid loading the model twice).
        _embedder = embedder
        if not _embedder.is_loaded():
            _embedder.load_model()

        seeded = 0
        batch_size = 32

        for i in range(0, len(issues_with_labels), batch_size):
            batch = issues_with_labels[i:i + batch_size]

            texts = [f"{issue['title']}\n{issue['body'][:2000]}" for issue in batch]
            try:
                embeddings = _embedder.embed_batch(texts)
            except Exception as e:
                logger.warning(f"Batch embedding failed at {i}: {e}")
                continue

            for issue, embedding in zip(batch, embeddings):
                try:
                    labels = issue["labels"]
                    team = infer_team(labels, issue["title"])
                    chroma.add_issue(
                        issue_number=issue["number"],
                        title=issue["title"],
                        embedding=embedding,
                        metadata={
                            "labels": labels[:10],
                            "team": team,
                            "state": "accepted",
                            "corrected_labels": json.dumps(labels[:10]),
                            "corrected_team": team,
                            "github_state": issue["state"],
                        },
                    )
                    seeded += 1
                except Exception as e:
                    logger.warning(f"Failed to seed #{issue['number']}: {e}")

            if (i + batch_size) % 500 == 0:
                logger.info(f"  Progress: {seeded}/{len(issues_with_labels)} seeded")

        logger.info(f"Seed complete: {seeded} issues stored in ChromaDB")
    except Exception as e:
        logger.error(f"Seed failed during embedding: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.host, port=config.port)


# ─── Batch Triage ────────────────────────────────────────────────────────

class BatchIssueInput(BaseModel):
    issueNumber: int
    issueTitle: str
    issueUrl: str
    issueBody: str = ""
    existingLabels: list[str] = []


class BatchTriageRequest(BaseModel):
    issues: list[BatchIssueInput]


@app.post("/batch-triage")
async def batch_triage(request: BatchTriageRequest, _=Security(require_api_key)):
    """Triage all issues in one go. Returns results for the caller to store in Firestore."""
    total = len(request.issues)
    if total > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Batch too large: {total} issues (max {MAX_BATCH_SIZE}).",
        )

    results = []
    logger.info(f"Batch triage: processing {total} issues")

    for idx, issue in enumerate(request.issues):
        try:
            result = await _triage_one(
                issue_number=issue.issueNumber,
                title=issue.issueTitle,
                body=issue.issueBody or "",
                existing_labels=issue.existingLabels or [],
            )
            result["existingLabels"] = issue.existingLabels or []
            results.append(result)

            if (idx + 1) % 10 == 0:
                logger.info(f"  Batch progress: {idx + 1}/{total}")

        except Exception as e:
            logger.error(f"  Failed to triage #{issue.issueNumber}: {e}")

    logger.info(f"Batch triage complete: {len(results)}/{total} succeeded")
    return {"results": results, "triaged": len(results), "total": total}
