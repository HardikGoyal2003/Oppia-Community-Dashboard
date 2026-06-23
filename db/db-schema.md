# DB Schema

This document describes the Firestore schema currently enforced by the DB layer.

## Collections

### `users`

Document id:

- `uid` of the authenticated user, we get from the github provider.

Fields:

- `email: string`
- `fullName: string`
- `photoURL: string`
- `githubUsername: string`
- `role: "SUPER_ADMIN" | "ADMIN" | "TEAM_LEAD" | "LEAD_TRAINEE" | "TEAM_MEMBER" | "CONTRIBUTOR"`
- `team: "LEAP" | "CORE" | "DEV_WORKFLOW" | "CLAM" | "DEV_WORKFLOW_INFRA" | null` **(Can be null when a new user sign-in on the dashboard)**
- `platform: "WEB" | "ANDROID" | null` **(Can be null when a new user sign-in on the dashboard)**
- `createdAt: Timestamp`

Subcollections:

### `users/{uid}/notifications`

Document id:

- auto-generated notification id

Fields:

- `message: string`
- `read: boolean`
- `createdAt: Timestamp`

### `archivedIssues`

Document id:

- `${platform}_${issueNumber}`

Fields:

- `issueNumber: number`
- `issueUrl: string`
- `issueTitle: string`
- `lastCommentCreatedAt: Timestamp`
- `linkedProject: string`
- `platform: "WEB" | "ANDROID"`
- `archivedBy: string`
- `archivedAt: Timestamp`

### `memberAccessRequests`

Document id:

- auto-generated request id

Fields:

- `userId: string`
- `platform: "WEB" | "ANDROID"`
- `team: string`
- `role: string`
- `note: string`
- `username: string`
- `status: "PENDING" | "ACCEPTED" | "REJECTED"`
- `createdAt: Timestamp`

### `teams`

Document id:

- stable team id like `WEB_CORE` or `ANDROID_CLAM`

Fields:

- `platform: "WEB" | "ANDROID"`
- `teamName: string`
- `leads: Array<{ uid: string, username: string, role: "TEAM_LEAD" | "LEAD_TRAINEE" }>`
- `gfiCounts.frontend: number`
- `gfiCounts.backend: number`
- `gfiCounts.fullstack: number`
- `gfiCounts.uncategorized: number`
- `lastUpdated: Timestamp`

### `dailyTeamMetrics`

Document id:

- `${teamId}_${capturedAtMillis}`

Fields:

- `teamId: string`
- `teamName: string`
- `platform: "WEB" | "ANDROID"`
- `dateKey: string` **(IST-normalized YYYY-MM-DD reporting day bucket)**
- `capturedAt: Timestamp`
- `unansweredIssuesCount: number`

### `dataJobRuns`

Document id:

- auto-generated run id

Fields:

- `jobKey: string`
- `jobName: string`
- `kind: "AUDIT" | "BACKFILL" | "MIGRATION" | "CLEANUP"`
- `status: "RUNNING" | "SUCCEEDED" | "FAILED"`
- `dryRun: boolean`
- `triggeredByUserId: string`
- `triggeredByGithubUsername: string`
- `summary: string`
- `errorMessage: string | null`
- `startedAt: Timestamp`
- `finishedAt: Timestamp | null`

### `orgMeta`

Document id:

- platform string (`WEB` or `ANDROID`)

Fields:

- `orgMembers: string[]`
- `collaborators: Array<{ login: string, permission: string }>`
- `lastUpdated: Timestamp`

## Derived Type Summary

Normalized app-layer models convert Firestore timestamps as follows:

- `users.createdAt -> Date`
- `users/{uid}/notifications.createdAt -> Date`
- `memberAccessRequests.createdAt -> Date`
- `teams.lastUpdated -> Date`
- `dailyTeamMetrics.capturedAt -> Date`
- `dataJobRuns.startedAt -> Date`
- `dataJobRuns.finishedAt -> Date | null`
