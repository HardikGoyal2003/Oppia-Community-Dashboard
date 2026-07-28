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
from classifier_service import LabelClassifier
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
classifier = None  # Initialized after ChromaDB loads


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
        global classifier
        classifier = LabelClassifier(chroma)
        logger.info("Label classifier initialized.")

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
    """Run AI triage on a single issue with classifier + LLM.

    Pipeline:
    1. Embed the issue text
    2. kNN classifier predicts labels from historical issues in ChromaDB
    3. LLM refines predictions using classifier output as context
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

    # 2. Run kNN classifier (uses all issues in ChromaDB)
    knn_prediction = {}
    if classifier:
        try:
            knn_prediction = await asyncio.to_thread(
                classifier.predict, embedding, config.knn_default_k
            )
            logger.info(
                f"  kNN prediction: labels={knn_prediction.get('labels')}, "
                f"team={knn_prediction.get('team')}, "
                f"confidence={knn_prediction.get('confidenceScore')}%"
            )
        except Exception as e:
            logger.warning(f"  kNN classifier failed: {e}")

    # 3. Search for few-shot examples (accepted/edited issues)
    few_shot_examples = chroma.search_for_few_shot(embedding, n_results=5)

    # 4. Build context with kNN predictions + few-shot examples
    context = _build_context(
        similar_issues=[],
        few_shot_examples=few_shot_examples,
        knn_prediction=knn_prediction,
    )

    # 5. Ask LLM to refine predictions (blocking HTTP → worker thread)
    llm_prediction = await asyncio.to_thread(
        llm.predict, title, body, context, existing_labels
    )

    # 6. Merge predictions: classifier is primary, LLM refines
    prediction = _merge_predictions(knn_prediction, llm_prediction, existing_labels)

    # 7. Compute newLabels: labels to ADD, excluding existing ones
    all_predicted = prediction.get("labels", [])
    new_labels = [l for l in all_predicted if l not in existing_labels]
    prediction["newLabels"] = new_labels

    # 8. Store embedding in ChromaDB — never overwrite verified ground truth.
    chroma.add_prediction(
        issue_number=issue_number,
        title=title,
        embedding=embedding,
        metadata={
            "labels": prediction.get("labels", []),
            "team": prediction.get("team", ""),
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
        "similarIssues": knn_prediction.get("similarIssues", []),
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
    knn_prediction: dict = None,
) -> str:
    """Build context for the LLM prompt.

    Includes:
    - kNN classifier predictions (from historical issues in ChromaDB)
    - Few-shot examples from reviewer-verified triage decisions
    - Similar issues for reference
    """
    parts = []

    # kNN classifier predictions from historical data
    if knn_prediction and knn_prediction.get("_method") == "knn_classifier":
        labels = knn_prediction.get("labels", [])
        team = knn_prediction.get("team", "")
        conf = knn_prediction.get("confidenceScore", 0)
        parts.append(
            f"The kNN classifier (trained on {chroma.count()} historical issues) predicts:\n"
            f"- Labels: {labels}\n"
            f"- Team: {team}\n"
            f"- Priority: {knn_prediction.get('priority', 'medium')}\n"
            f"- Confidence: {conf}%\n"
            f"Use these as a strong starting point. Refine only if the issue clearly "
            f"differs from similar historical issues."
        )
        parts.append("")

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


def _merge_predictions(knn_pred: dict, llm_pred: dict, existing_labels: list[str] = None) -> dict:
    """Merge kNN classifier and LLM predictions.

    Strategy:
    - kNN is the base (trained on historical issues, high recall)
    - LLM refines (adds context understanding, catches edge cases)
    - If the LLM fell back to heuristic (no API), trust kNN exclusively
    - If both are real, weight by confidence tiers as before
    - newLabels computed: predicted labels excluding existing ones
    """
    existing_labels = existing_labels or []

    if not knn_pred or knn_pred.get("_method") != "knn_classifier":
        # No kNN prediction, use LLM only
        return llm_pred

    knn_conf = knn_pred.get("confidenceScore", 0)
    llm_conf = llm_pred.get("confidenceScore", 0)
    llm_is_fallback = llm_pred.get("_method") == "heuristic_fallback"

    if llm_is_fallback:
        # LLM unavailable — trust kNN as the sole signal.
        # The fallback heuristic is keyword-based with low confidence (40),
        # so blending it in only hurts.  Use kNN labels/team/priority as-is
        # but keep the kNN confidence as the final score.
        return {
            "labels": knn_pred.get("labels", ["bug"]),
            "team": _normalize_team(knn_pred.get("team", "CORE")),
            "repository": knn_pred.get("repository") or llm_pred.get("repository", "oppia/oppia"),
            "cuj": knn_pred.get("cuj") or llm_pred.get("cuj", "Learner Experience"),
            "goodFirstIssue": knn_pred.get("goodFirstIssue", False),
            "priority": knn_pred.get("priority", "medium"),
            "severity": knn_pred.get("severity", "minor"),
            "confidenceScore": knn_conf,
            "explanation": (
                f"kNN classifier (on {chroma.count()} historical issues) with "
                f"{knn_conf}% confidence. LLM was unavailable (heuristic fallback); "
                f"prediction relies on nearest-neighbor voting only."
            ),
            "labelConfidences": knn_pred.get("labelConfidences", {}),
        }

    # Both kNN and LLM are real predictions — weight by confidence tiers.
    high_threshold = config.knn_high_confidence_threshold
    med_threshold = config.knn_medium_confidence_threshold
    high_weight = config.knn_high_weight
    med_weight = config.knn_medium_weight
    low_weight = config.knn_low_weight

    if knn_conf >= high_threshold:
        labels = knn_pred.get("labels", llm_pred.get("labels", ["bug"]))
        team = knn_pred.get("team", llm_pred.get("team", "CORE"))
        priority = knn_pred.get("priority", llm_pred.get("priority", "medium"))
        severity = knn_pred.get("severity", llm_pred.get("severity", "minor"))
        confidence = round((knn_conf * high_weight) + (llm_conf * (1 - high_weight)), 1)
    elif knn_conf >= med_threshold:
        knn_labels = set(knn_pred.get("labels", []))
        llm_labels = set(llm_pred.get("labels", []))
        labels = list(knn_labels | llm_labels) if knn_labels and llm_labels else (
            list(knn_labels) if knn_labels else list(llm_labels)
        )
        team = knn_pred.get("team") if knn_pred.get("team") else llm_pred.get("team", "CORE")
        priority = knn_pred.get("priority") if knn_pred.get("priority") else llm_pred.get("priority", "medium")
        severity = knn_pred.get("severity") if knn_pred.get("severity") else llm_pred.get("severity", "minor")
        confidence = round((knn_conf * med_weight) + (llm_conf * (1 - med_weight)), 1)
    else:
        labels = llm_pred.get("labels", knn_pred.get("labels", ["bug"]))
        team = llm_pred.get("team", knn_pred.get("team", "CORE"))
        priority = llm_pred.get("priority", knn_pred.get("priority", "medium"))
        severity = llm_pred.get("severity", knn_pred.get("severity", "minor"))
        confidence = round((knn_conf * low_weight) + (llm_conf * (1 - low_weight)), 1)

    # Compute newLabels: exclude existing labels
    new_labels = [l for l in labels if l not in existing_labels]

    # Build a detailed explanation combining both sources
    explanation_parts = []

    # kNN explanation: which neighbors influenced the decision
    if knn_pred.get("similarIssues"):
        top_similar = knn_pred["similarIssues"][:3]
        similar_nums = ", ".join(f"#{s['number']}" for s in top_similar)
        similar_labels = set()
        for s in top_similar:
            # Get labels from similar issues metadata
            for lbl in s.get("labels", []):
                similar_labels.add(lbl)
        if similar_labels:
            explanation_parts.append(
                f"The kNN classifier found {len(knn_pred.get('similarIssues', []))} similar issues "
                f"({similar_nums}) which had labels: {', '.join(sorted(similar_labels))}. "
                f"The classifier voted for {', '.join(labels)} with {knn_conf}% confidence."
            )
        else:
            explanation_parts.append(
                f"The kNN classifier found {len(knn_pred.get('similarIssues', []))} similar issues "
                f"({similar_nums}) and voted for {', '.join(labels)} with {knn_conf}% confidence."
            )

    # LLM explanation: why the LLM chose these labels
    llm_explanation = llm_pred.get("explanation", "")
    if llm_explanation and "Heuristic analysis" not in llm_explanation:
        explanation_parts.append(f"LLM analysis ({llm_conf}% confidence): {llm_explanation}")
    elif llm_explanation:
        explanation_parts.append(llm_explanation)

    # Team assignment reasoning
    explanation_parts.append(
        f"The {team} team was selected as the primary owner of this issue."
    )

    # Final explanation
    explanation = " ".join(explanation_parts) if explanation_parts else (
        f"Combined prediction from kNN ({knn_conf}%) and LLM ({llm_conf}%) "
        f"analysis of the issue content."
    )

    return {
        "labels": labels,
        "newLabels": new_labels,
        "team": _normalize_team(team),
        "repository": knn_pred.get("repository") or llm_pred.get("repository", "oppia/oppia"),
        "cuj": knn_pred.get("cuj") or llm_pred.get("cuj", "Learner Experience"),
        "goodFirstIssue": knn_pred.get("goodFirstIssue", llm_pred.get("goodFirstIssue", False)),
        "priority": priority,
        "severity": severity,
        "confidenceScore": confidence,
        "explanation": explanation,
        "labelConfidences": knn_pred.get("labelConfidences", {}),
    }


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
                    team = "LEAP" if any(l in labels for l in ["translation", "i18n"]) else (
                        "Developer Workflow" if "documentation" in labels else "CORE"
                    )
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
