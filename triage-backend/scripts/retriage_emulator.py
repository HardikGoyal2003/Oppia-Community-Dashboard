#!/usr/bin/env python3
"""Re-triage the issues already stored in the Firestore emulator.

Reads the existing issueTriage docs, re-runs the triage backend (/triage,
LLM-backed) for each one, and patches the prediction fields back into
Firestore. No GitHub API is required.

The emulator docs do not contain the issue body, so triage relies on the
title, existing labels, and similar verified issues pulled from ChromaDB.

Resumable: finished issue numbers are stored in a checkpoint file so a
long run can be picked up again without redoing completed issues.
"""
import json
import os
import sys
import time
import traceback

import httpx

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TRIAGE_BACKEND = "http://127.0.0.1:8000"
FS_BASE = "http://127.0.0.1:8080/v1/projects/demo-oppia-community-dashboard/databases/(default)/documents"
CHECKPOINT = os.path.join(os.path.dirname(__file__), ".retriage_checkpoint.json")


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT, "r") as f:
            return set(json.load(f))
    return set()


def save_checkpoint(done):
    with open(CHECKPOINT, "w") as f:
        json.dump(sorted(done), f)


def fetch_emulator_issues():
    """Paginate all issueTriage docs from the Firestore emulator."""
    issues = []
    token = None
    while True:
        url = f"{FS_BASE}/issueTriage" + (f"?pageToken={token}" if token else "")
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        for doc in data.get("documents", []):
            fields = doc.get("fields", {})
            num = fields.get("issueNumber", {}).get("integerValue")
            if num is None:
                continue
            issues.append(
                {
                    "issueNumber": int(num),
                    "issueTitle": fields.get("issueTitle", {}).get("stringValue", ""),
                    "issueUrl": fields.get("issueUrl", {}).get("stringValue", ""),
                    "issueBody": "",
                    "existingLabels": [
                        v["stringValue"]
                        for v in fields.get("existingLabels", {})
                        .get("arrayValue", {})
                        .get("values", [])
                    ],
                }
            )
        token = data.get("nextPageToken")
        if not token:
            break
    return issues


def patch_prediction(issue_number, result):
    """Patch prediction fields onto the existing Firestore doc."""
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
                "goodFirstIssue": {"booleanValue": result.get("goodFirstIssue", False)},
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
    # Only touch the prediction map + updatedAt. A PATCH without updateMask
    # REPLACES the whole document on Firestore — that would wipe issueNumber,
    # issueTitle, issueUrl, existingLabels, status and createdAt.
    mask = "?updateMask.fieldPaths=prediction&updateMask.fieldPaths=updatedAt"
    resp = httpx.patch(
        f"{FS_BASE}/issueTriage/{issue_number}{mask}",
        json=body,
        timeout=30,
    )
    return resp.status_code in (200, 201)


def main():
    force = "--force" in sys.argv
    issues = fetch_emulator_issues()
    issues.sort(key=lambda i: i["issueNumber"])
    done = set() if force else load_checkpoint()
    print(f"=== Emulator Retriage ===  {len(issues)} issues, {len(done)} already done"
          f"{' (FORCE: re-running all)' if force else ''}")
    if done:
        print("(remove --force to keep skips)")
    print()

    for i, issue in enumerate(issues, 1):
        num = issue["issueNumber"]
        if num in done:
            continue
        try:
            resp = httpx.post(
                f"{TRIAGE_BACKEND}/triage",
                json={"issue": issue},
                timeout=900,
            )
            if resp.status_code != 200:
                print(f"[{i}/{len(issues)}] #{num} ERROR {resp.status_code}: {resp.text[:120]}")
                continue
            result = resp.json()
            if not patch_prediction(num, result):
                print(f"[{i}/{len(issues)}] #{num} STORE FAILED")
                continue
            done.add(num)
            save_checkpoint(done)
            print(
                f"[{i}/{len(issues)}] #{num} OK team={result.get('team','?')} "
                f"labels={result.get('labels')} conf={result.get('confidenceScore')}"
            )
        except Exception as e:
            print(f"[{i}/{len(issues)}] #{num} EXC {type(e).__name__}: {e}")
            traceback.print_exc()
        sys.stdout.flush()
        time.sleep(0.8)

    print(f"\n=== Done: {len(done)}/{len(issues)} issues retriaged. ===")


if __name__ == "__main__":
    main()