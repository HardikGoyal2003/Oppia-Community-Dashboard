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
- `role: "SUPER_ADMIN" | "ADMIN" | "TEAM_LEAD" | "TEAM_MEMBER" | "CONTRIBUTOR"`
- `team: string | null` **(Can be null when a new user sign-in on the dashboard)**
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
- `isArchived: true` **(Audit if this field is needed or not)**
- `lastCommentCreatedAt: Timestamp`
- `linkedProject: string`
- `platform: "WEB" | "ANDROID"`

Notes:

- this schema currently mirrors the shared `Issue` domain type plus `platform`
- `isArchived` is currently persisted even though the collection itself already implies archived state

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

## Derived Type Summary

Normalized app-layer models convert Firestore timestamps as follows:

- `users.createdAt -> Date`
- `users/{uid}/notifications.createdAt -> Date`
- `memberAccessRequests.createdAt -> Date`
- `dataJobRuns.startedAt -> Date`
- `dataJobRuns.finishedAt -> Date | null`
