#!/usr/bin/env python3
"""Seed the issueTriage collection with metadata for every open 'triage needed' issue.

Writes only metadata (issueNumber/title/url/labels/status/createdAt) via updateMask,
leaving any existing prediction untouched. Run this after the Firestore emulator
restarts (its data is in-memory only), then run retriage_emulator.py to (re)fill
predictions.
"""
import time
from dotenv import load_dotenv

load_dotenv()
from retriage import fetch_github_issues, FS_BASE  # noqa: E402
import httpx  # noqa: E402


def seed(issue):
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    body = {
        "fields": {
            "issueNumber": {"integerValue": str(issue["number"])},
            "issueTitle": {"stringValue": issue["title"]},
            "issueUrl": {"stringValue": issue["html_url"]},
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
    resp = httpx.patch(f"{FS_BASE}/issueTriage/{issue['number']}?{mask}",
                       json=body, timeout=30)
    return resp.status_code in (200, 201)


def main():
    print("Fetching open 'triage needed' issues from GitHub...")
    issues = fetch_github_issues()
    issues.sort(key=lambda i: i["number"])
    print(f"\nSeeding {len(issues)} docs into Firestore emulator...")
    ok = 0
    for n, issue in enumerate(issues, 1):
        try:
            if seed(issue):
                ok += 1
            else:
                print(f"[{n}/{len(issues)}] #{issue['number']} WRITE FAILED")
        except Exception as e:
            print(f"[{n}/{len(issues)}] #{issue['number']} ERROR: {str(e)[:120]}")
        if n % 25 == 0 or n == len(issues):
            print(f"[{n}/{len(issues)}] seeded {ok}")
    print(f"\n=== Done: seeded {ok}/{len(issues)} docs. ===")


if __name__ == "__main__":
    main()