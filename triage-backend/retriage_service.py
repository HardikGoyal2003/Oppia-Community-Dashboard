"""
Firestore (SDK) + GitHub plumbing for the permanent /retriage endpoint.

The daily cron only triages issues that are missing entirely from the
issueTriage collection (its "untriaged" check is doc-presence). This module
supports re-predicting issues that DO have a doc but whose stored prediction
is missing, came from the LLM-unavailable heuristic fallback, or scored too
low — the gap the old `retriage_emulator.py` script covered by hand.

Firestore is accessed through the google-cloud-firestore SDK — the same auth
path as VectorService — so the sweep works against the emulator in dev
(FIRESTORE_EMULATOR_HOST) and against real Firestore in production with
Application Default Credentials. The v1 REST calls this module previously
used were unauthenticated and cannot work against a real project.
"""
import logging
import os
import time
from typing import Optional

import httpx
from google.cloud import firestore

from config import config

logger = logging.getLogger(__name__)

HEURISTIC_METHODS = {"heuristic_fallback", "unknown"}

_db: Optional[firestore.Client] = None


def _get_db() -> firestore.Client:
    """Lazily build the Firestore client (emulator-aware, like VectorService)."""
    global _db
    if _db is None:
        rest_base = config.firestore_rest_base or ""
        if "127.0.0.1" in rest_base or "localhost" in rest_base:
            os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
        _db = firestore.Client(project=config.firebase_project_id)
    return _db


def list_issue_docs() -> list[dict]:
    """Stream every issueTriage doc, returning parsed issues + predictions."""
    issues: list[dict] = []
    for doc in _get_db().collection("issueTriage").stream():
        fields = doc.to_dict() or {}
        num = fields.get("issueNumber")
        if num is None:
            continue
        issues.append({
            "issueNumber": int(num),
            "issueTitle": fields.get("issueTitle", ""),
            "issueUrl": fields.get("issueUrl", ""),
            "existingLabels": fields.get("existingLabels") or [],
            "prediction": fields.get("prediction"),
        })
    return issues


def needs_retriage(issue: dict, stale_only: bool, min_confidence: float) -> bool:
    """Decide whether an existing doc needs a fresh prediction.

    A doc is stale when it has no prediction at all, the prediction came from
    the LLM-unavailable heuristic fallback, or the confidence is below the
    caller's cutoff.
    """
    pred = issue.get("prediction")
    if not pred:
        return True
    method = pred.get("_method", "")
    if method in HEURISTIC_METHODS:
        return True
    if stale_only:
        confidence = float(pred.get("confidenceScore") or 0)
        if confidence < min_confidence:
            return True
    return False


def fetch_github_issue(issue_number: int) -> Optional[dict]:
    """Fetch one issue from the target repo, or None on any failure.

    The retrier prefers this so the LLM gets the issue body, which is not
    stored in the issueTriage docs (they only hold title + current labels).
    """
    headers = {"Accept": "application/vnd.github.v3+json"}
    if config.github_token:
        headers["Authorization"] = f"token {config.github_token}"
    try:
        resp = httpx.get(
            f"https://api.github.com/repos/{config.github_repo}/issues/{issue_number}",
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "number": data.get("number", issue_number),
            "title": data.get("title", ""),
            "html_url": data.get("html_url", ""),
            "body": data.get("body") or "",
            "state": data.get("state", "open"),
            "labels": [
                l.get("name", "")
                for l in data.get("labels", [])
                if isinstance(l, dict)
            ],
        }
    except Exception as e:
        logger.warning(f"fetch_github_issue#{issue_number} failed: {e}")
        return None


def patch_prediction(issue_number: int, result: dict) -> bool:
    """Write the prediction onto an existing doc (partial update).

    The SDK's update() only touches the listed paths — unlike a REST PATCH
    without an updateMask, it never replaces issueNumber/issueTitle/
    issueUrl/existingLabels/status/createdAt.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    prediction = {
        "labels": result.get("labels", []),
        "newLabels": result.get("newLabels", []),
        "team": result.get("team", "CORE"),
        "repository": result.get("repository", "oppia/oppia"),
        "cuj": result.get("cuj", "Learner Experience"),
        "goodFirstIssue": bool(result.get("goodFirstIssue", False)),
        "priority": result.get("priority", "medium"),
        "severity": result.get("severity", "minor"),
        "confidenceScore": float(result.get("confidenceScore", 0.0)),
        "explanation": result.get("explanation", ""),
        "similarIssues": [
            {
                "number": s.get("number", 0),
                "title": s.get("title", ""),
                "score": float(s.get("score", 0.0)),
            }
            for s in result.get("similarIssues", [])
        ],
        "_method": result.get("method", "heuristic_fallback"),
    }
    try:
        _get_db().collection("issueTriage").document(str(issue_number)).update({
            "prediction": prediction,
            "updatedAt": now,
        })
        return True
    except Exception as e:
        logger.error(f"Patch prediction #{issue_number} failed: {e}")
        return False


def serialize_prediction(pred: Optional[dict]) -> Optional[dict]:
    """Flatten a stored prediction map for dry-run reporting."""
    if not pred:
        return None
    return {
        "labels": pred.get("labels", []),
        "team": pred.get("team", ""),
        "confidenceScore": pred.get("confidenceScore", 0),
        "method": pred.get("_method", ""),
    }