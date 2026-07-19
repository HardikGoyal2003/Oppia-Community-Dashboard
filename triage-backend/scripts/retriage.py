#!/usr/bin/env python3
"""Re-triage all open issues using the LLM-backed Python backend.

Uses Firestore REST API (works with emulator without credentials).
"""
import json
import os
import sys
import time
from urllib.parse import quote
from dotenv import load_dotenv
import httpx

load_dotenv()
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env.local"), override=True)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
TRIAGE_BACKEND = "http://127.0.0.1:8000"
FS_BASE = "http://127.0.0.1:8080/v1/projects/demo-oppia-community-dashboard/databases/(default)/documents"


def fetch_github_issues():
    """Fetch all open issues with 'triage needed' label from oppia/oppia."""
    all_issues = []
    page = 1
    headers = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}

    while True:
        url = "https://api.github.com/search/issues"
        params = {
            "q": 'repo:oppia/oppia state:open type:issue label:"triage needed"',
            "per_page": 100,
            "page": page,
            "sort": "created",
            "order": "desc",
        }
        resp = httpx.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        all_issues.extend(items)
        print(f"  Page {page}: {len(items)} issues (total: {len(all_issues)})")

        if len(items) < 100:
            break
        page += 1
        if page > 10:
            break

    return all_issues


def clear_firestore_triage():
    """Delete all documents in the issueTriage collection via REST API."""
    resp = httpx.get(f"{FS_BASE}/issueTriage", timeout=30)
    if resp.status_code != 200:
        print(f"  Could not list: {resp.status_code}")
        return 0

    data = resp.json()
    docs = data.get("documents", [])
    if not docs:
        print("  No existing documents to clear.")
        return 0

    # Batch delete via commit API
    writes = [{"delete": doc["name"]} for doc in docs]
    commit_body = json.dumps({"writes": writes})
    resp = httpx.post(
        f"{FS_BASE}:commit",
        content=commit_body,
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if resp.status_code == 200:
        print(f"  Cleared {len(docs)} documents.")
    else:
        print(f"  Delete failed: {resp.status_code} {resp.text[:200]}")
    return len(docs)


def store_in_firestore(issue_data):
    """Store a single triage result in Firestore via REST API."""
    doc_id = str(issue_data["issueNumber"])
    body = {
        "fields": {
            "issueNumber": {"integerValue": str(issue_data["issueNumber"])},
            "issueTitle": {"stringValue": issue_data.get("issueTitle", "")},
            "issueUrl": {"stringValue": issue_data.get("issueUrl", "")},
            "team": {"stringValue": issue_data.get("team", "CORE")},
            "labels": {"arrayValue": {"values": [{"stringValue": l} for l in issue_data.get("labels", [])]}},
            "newLabels": {"arrayValue": {"values": [{"stringValue": l} for l in issue_data.get("newLabels", [])]}},
            "repository": {"stringValue": issue_data.get("repository", "oppia/oppia")},
            "cuj": {"stringValue": issue_data.get("cuj", "Learner Experience")},
            "goodFirstIssue": {"booleanValue": issue_data.get("goodFirstIssue", False)},
            "priority": {"stringValue": issue_data.get("priority", "medium")},
            "severity": {"stringValue": issue_data.get("severity", "minor")},
            "confidenceScore": {"doubleValue": float(issue_data.get("confidenceScore", 0.0))},
            "explanation": {"stringValue": issue_data.get("explanation", "")},
            "similarIssues": {"arrayValue": {"values": [
                {"mapValue": {"fields": {
                    "number": {"integerValue": str(s.get("number", 0))},
                    "title": {"stringValue": s.get("title", "")},
                    "score": {"doubleValue": float(s.get("score", 0.0))},
                }}}
                for s in issue_data.get("similarIssues", [])
            ]}},
            "existingLabels": {"arrayValue": {"values": [{"stringValue": l} for l in issue_data.get("existingLabels", [])]}},
            "status": {"stringValue": "pending"},
            "createdAt": {"stringValue": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            "updatedAt": {"stringValue": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        }
    }
    resp = httpx.patch(f"{FS_BASE}/issueTriage/{doc_id}", json=body, timeout=30)
    return resp.status_code in (200, 201)


def main():
    print("=== Retriage Script ===\n")

    print("Step 1: Fetching open issues with 'triage needed' from GitHub...")
    issues = fetch_github_issues()
    if not issues:
        print("No issues found. Exiting.")
        return
    print(f"\nFound {len(issues)} open issues.\n")

    print("Step 2: Clearing existing triage data from Firestore...")
    clear_firestore_triage()
    print()

    print("Step 3: Sending issues to triage backend (LLM-powered)...")
    batch_size = 30
    all_results = []

    for i in range(0, len(issues), batch_size):
        batch = issues[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(issues) + batch_size - 1) // batch_size
        payload = {
            "issues": [
                {
                    "issueNumber": issue["number"],
                    "issueTitle": issue["title"],
                    "issueUrl": issue["html_url"],
                    "issueBody": (issue.get("body") or "")[:2000],
                    "existingLabels": [l["name"] for l in issue.get("labels", [])],
                }
                for issue in batch
            ]
        }

        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} issues)...")
        try:
            resp = httpx.post(
                f"{TRIAGE_BACKEND}/batch-triage",
                json=payload,
                timeout=900,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                all_results.extend(results)
                # Log a sample
                if results:
                    r = results[0]
                    print(f"    Sample: #{r['issueNumber']} team={r.get('team','?')} conf={r.get('confidenceScore',0)}")
                print(f"    Got {len(results)}/{len(batch)} results")
            else:
                print(f"    Backend error: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            print(f"    Request failed: {e}")

    print(f"\nTriage complete: {len(all_results)}/{len(issues)} issues triaged.\n")

    print("Step 4: Storing results in Firestore...")
    stored = 0
    for result in all_results:
        issue = next((i for i in issues if i["number"] == result["issueNumber"]), None)
        if issue:
            result["issueTitle"] = issue["title"]
            result["issueUrl"] = issue["html_url"]
            result["existingLabels"] = [l["name"] for l in issue.get("labels", [])]

        try:
            if store_in_firestore(result):
                stored += 1
        except Exception as e:
            print(f"  Failed to store #{result.get('issueNumber')}: {e}")

    print(f"  Stored {stored}/{len(all_results)} results in Firestore.")
    print(f"\n=== Done! {stored} issues retriaged with LLM. ===")


if __name__ == "__main__":
    main()
