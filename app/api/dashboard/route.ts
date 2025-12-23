import { NextResponse } from "next/server";
import { main } from "@/lib/github/scripts/github-issues.fetcher";
import { RawIssue, RawIssueNode } from "@/lib/github/github-fetcher.types";
import { formatIssues } from "@/lib/github/service/ format-issues.service";


const y = [
    {
        "number": 22357,
        "title": "[BUG]: No longer an \"All\" options when filtering by topic",
        "url": "https://github.com/oppia/oppia/issues/22357",
        "state": "OPEN",
        "comments": {
            "nodes": [
                {
                    "author": {
                        "login": "deepshikhatutorials"
                    },
                    "createdAt": "2025-12-12T20:11:01Z"
                }
            ]
        },
        "projectsV2": {
            "nodes": [
                {
                    "title": "Contributor Experience Team"
                }
            ]
        }
    },
]

export async function GET() {
  try {
    const issuesData: RawIssueNode[] = await main();

    const normalizedIssues: RawIssue[] = formatIssues(issuesData);
    
    return NextResponse.json({
      issues: normalizedIssues,
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch GitHub issues" },
      { status: 500 }
    );
  }
}