"""
Firestore (REST) + GitHub plumbing for the permanent /retriage endpoint.

The daily cron only triages issues that are missing entirely from the
issueTriage collection (its "untriaged" check is doc-presence). This module
supports re-predicting issues that DO have a doc but whose stored prediction
is missing, came from the LLM-unavailable heuristic fallback, or scored too
low — the gap the old `retriage_emulator.py` script covered by hand.

Firestore is accessed over the v1 REST API (works against the emulator
without service-account credentials; the base URL is overridable in .env via
FIRESTORE_REST_BASE for other environments).
"""
import logging
import time
from typing import Optional

import httpx

from config import config

logger = logging.getLogger(__name__)

HEURISTIC_METHODS = {"heuristic_fallback", "unknown"}


def list_issue_docs() -> list[dict]:
    """Paginate every issueTriage doc, returning parsed issues + predictions."""
    issues: list[dict] = []
    token: Optional[str] = None
    while True:
        url = f"{config.firestore_rest_base}/issueTriage"
        if token:
            url += f"?pageToken={token}"
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        for doc in data.get("documents", []):
            issue = _parse_doc(doc)
            if issue is not None:
                issues.append(issue)
        token = data.get("nextPageToken")
        if not token:
            break
    return issues


def _parse_doc(doc: dict) -> Optional[dict]:
    """Flatten a Firestore doc into the shape the retrier needs."""
    fields = doc.get("fields", {})
    num = fields.get("issueNumber", {}).get("integerValue")
    if num is None:
        return None
    prediction = fields.get("prediction", {}).get("mapValue", {}).get("fields", {})
    return {
        "issueNumber": int(num),
        "issueTitle": fields.get("issueTitle", {}).get("stringValue", ""),
        "issueUrl": fields.get("issueUrl", {}).get("stringValue", ""),
        "existingLabels": [
            v["stringValue"]
            for v in fields.get("existingLabels", {})
            .get("arrayValue", {})
            .get("values", [])
        ],
        "prediction": prediction or None,
    }


def needs_retriage(issue: dict, stale_only: bool, min_confidence: float) -> bool:
    """Decide whether an existing doc needs a fresh prediction.

    A doc is stale when it has no prediction at all, the prediction came from
    the LLM-unavailable heuristic fallback, or the confidence is below the
    caller's cutoff.
    """
    pred = issue.get("prediction")
    if not pred:
        return True
    method = pred.get("_method", {}).get("stringValue", "")
    if method in HEURISTIC_METHODS:
        return True
    if stale_only:
        confidence = float(pred.get("confidenceScore", {}).get("doubleValue", 0) or 0)
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
    """Patch the prediction map (and updatedAt) onto an existing doc.

    Only the prediction + updatedAt fields are in the updateMask — a PATCH
    without updateMask REPLACES the whole document and would wipe
    issueNumber/issueTitle/issueUrl/existingLabels/status/createdAt.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    similar = result.get("similarIssues", [])
    body = {
        "fields": {
            "prediction": {"mapValue": {"fields": {
                "labels": {"arrayValue": {"values": [{"stringValue": l} for l in result.get("labels", [])]}},
                "newLabels": {"arrayValue": {"values": [{"stringValue": l} for l in result.get("newLabels", [])]}},
                "team": {"stringValue": result.get("team", "CORE")},
                "repository": {"stringValue": result.get("repository", "oppia/oppia")},
                "cuj": {"stringValue": result.get("cuj", "Learner Experience")},
                "goodFirstIssue": {"booleanValue": bool(result.get("goodFirstIssue", False))},
                "priority": {"stringValue": result.get("priority", "medium")},
                "severity": {"stringValue": result.get("severity", "minor")},
                "confidenceScore": {"doubleValue": float(result.get("confidenceScore", 0.0))},
                "explanation": {"stringValue": result.get("explanation", "")},
                "similarIssues": {"arrayValue": {"values": [
                    {"mapValue": {"fields": {
                        "number": {"integerValue": str(s.get("number", 0))},
                        "title": {"stringValue": s.get("title", "")},
                        "score": {"doubleValue": float(s.get("score", 0.0))},
                    }}}
                    for s in similar
                ]}},
                "_method": {"stringValue": result.get("method", "heuristic_fallback")},
            }}},
            "updatedAt": {"stringValue": now},
        }
    }
    mask = "?updateMask.fieldPaths=prediction&updateMask.fieldPaths=updatedAt"
    resp = httpx.patch(
        f"{config.firestore_rest_base}/issueTriage/{issue_number}{mask}",
        json=body,
        timeout=30,
    )
    return resp.status_code in (200, 201)


def serialize_prediction(pred: dict) -> Optional[dict]:
    """Flatten a stored prediction map for dry-run reporting."""
    if not pred:
        return None
    return {
        "labels": [v["stringValue"] for v in pred.get("labels", {}).get("arrayValue", {}).get("values", [])],
        "team": pred.get("team", {}).get("stringValue", ""),
        "confidenceScore": pred.get("confidenceScore", {}).get("doubleValue", 0),
        "method": pred.get("_method", {}).get("stringValue", ""),
    }