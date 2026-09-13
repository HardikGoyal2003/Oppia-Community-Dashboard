#!/usr/bin/env python3
"""Restore Firestore issueTriage metadata (title/url/labels/createdAt).

A previous version of retriage_emulator.py used PATCH without updateMask,
which REPLACED every document and wiped the metadata fields. The prediction
maps are still intact; this script re-fetches each issue from GitHub and
restores the missing fields WITHOUT touching the stored predictions.

Requires a valid GITHUB_TOKEN (the one in .env.local is expired).
"""
import json
import os
import sys
import time
import traceback

import httpx
from dotenv import load_dotenv

load_dotenv()
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FS_BASE = "http://127.0.0.1:8080/v1/projects/demo-oppia-community-dashboard/databases/(default)/documents"

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


def list_broken_docs():
    """Return (docName, issueNumber) for every doc where issueNumber is missing."""
    docs = []
    token = None
    while True:
        url = f"{FS_BASE}/issueTriage" + (f"?pageToken={token}" if token else "")
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        for doc in data.get("documents", []):
            num = doc["name"].rstrip("/").split("/")[-1]
            docs.append((doc["name"], num, doc.get("fields", {})))
        token = data.get("nextPageToken")
        if not token:
            break
    return docs


def fetch_github_issue(issue_number: int):
    """Fetch a single issue from GitHub (needs a valid token)."""
    last = None
    for attempt in range(4):
        try:
            resp = httpx.get(
                f"https://api.github.com/repos/oppia/oppia/issues/{issue_number}",
                headers={"Authorization": f"Bearer {GITHUB_TOKEN}"},
                timeout=60,
            )
            if resp.status_code in (408, 429, 500, 502, 503, 504):
                last = f"status {resp.status_code}"
                time.sleep(2 * attempt + 1)
                continue
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectTimeout, httpx.ReadTimeout) as e:
            last = str(e)
            time.sleep(2 * attempt + 1)
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (401, 403):
                raise
            last = str(e)
            time.sleep(2 * attempt + 1)
    raise RuntimeError(f"Failed to fetch #{issue_number} after retries: {last}")


def restore_doc(issue_number: int, issue: dict):
    """Write back the metadata fields via updateMask (prediction untouched)."""
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    body = {
        "fields": {
            "issueNumber": {"integerValue": str(issue["number"])},
            "issueTitle": {"stringValue": issue.get("title", "")},
            "issueUrl": {"stringValue": issue.get("html_url", "")},
            "existingLabels": {
                "arrayValue": {
                    "values": [{"stringValue": l["name"]} for l in issue.get("labels", [])]
                }
            },
            "status": {"stringValue": "pending"},
            "createdAt": {"stringValue": issue.get("created_at", now)},
            "updatedAt": {"stringValue": now},
        }
    }
    mask = "&".join(
        f"updateMask.fieldPaths={p}"
        for p in ["issueNumber", "issueTitle", "issueUrl", "existingLabels",
                  "status", "createdAt", "updatedAt"]
    )
    resp = httpx.patch(f"{FS_BASE}/issueTriage/{issue_number}?{mask}", json=body, timeout=30)
    return resp.status_code in (200, 201)


def main():
    if not GITHUB_TOKEN:
        print("ERROR: no GITHUB_TOKEN in environment. Add one to triage-backend/.env")
        sys.exit(1)

    docs = list_broken_docs()
    print(f"Found {len(docs)} triage docs to restore.")

    ok = 0
    failed = 0
    for i, (name, num, fields) in enumerate(docs, 1):
        # Skip docs that already have metadata (defensive)
        if "issueNumber" in fields:
            continue
        try:
            issue = fetch_github_issue(int(num))
            if not restore_doc(num, issue):
                print(f"[{i}/{len(docs)}] #{num} RESTORE FAILED")
                failed += 1
                continue
            ok += 1
            if i % 25 == 0 or i == len(docs):
                print(f"[{i}/{len(docs)}] progress: {ok} ok, {failed} failed")
        except Exception as e:
            print(f"[{i}/{len(docs)}] #{num} ERROR: {str(e)[:160]}")
            if "401" in str(e) or "403" in str(e) or "Invalid" in str(e):
                traceback.print_exc()
                break  # token / auth problem — stop
            failed += 1
        sys.stdout.flush()
        time.sleep(0.3)

    print(f"\nRestored {ok}, failed {failed}.")


if __name__ == "__main__":
    main()