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
- `role: "SUPER_ADMIN" | "ADMIN" | "TEAM_LEAD" | "LEAD_TRAINEE" | "TEAM_MEMBER" | "CONTRIBUTOR" | "ALUMNI"`
- `team: "LEAP" | "CORE" | "DEV_WORKFLOW" | "CLAM" | "DEV_WORKFLOW_INFRA" | null` **(Can be null when a new user sign-in on the dashboard)**
- `platform: "WEB" | "ANDROID" | null` **(Can be null when a new user sign-in on the dashboard)**
- `createdAt: Timestamp`
- `schemaVersion: number`

Subcollections:

### `users/{uid}/notifications`

Document id:

- auto-generated notification id

Fields:

- `message: string`
- `read: boolean`
- `createdAt: Timestamp`
- `schemaVersion: number`

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
- `archivedAt?: Timestamp`
- `schemaVersion: number`

### `archivedDiscussions`

Document id:

- `${platform}_${discussionNumber}`

Fields:

- `discussionNumber: number`
- `discussionUrl: string`
- `discussionTitle: string`
- `createdAt: Timestamp`
- `platform: "WEB" | "ANDROID"`
- `archivedBy?: string`
- `archivedAt?: Timestamp`
- `schemaVersion: number`

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
- `schemaVersion: number`

### `unregisteredMembers`

Document id:

- `${teamKey}__${normalizedUsername}` where `normalizedUsername` is derived at
  runtime from `githubUsername` by trimming and lowercasing it (for example
  `CORE__nithish084`)

Fields:

- `teamKey: "LEAP" | "CORE" | "DEV_WORKFLOW" | "CLAM" | "DEV_WORKFLOW_INFRA"`
- `platform: "WEB" | "ANDROID"`
- `githubUsername: string` **(username as written in the team member sheet)**
- `email: string`
- `fullName: string`
- `createdAt: Timestamp` **(first time the person was flagged)**
- `schemaVersion: number`

### `teams`

Document id:

- stable team id like `WEB_CORE` or `ANDROID_CLAM`

Fields:

- `platform: "WEB" | "ANDROID"`
- `teamName: string`
- `leads: Array<{ uid: string, username: string, role: "TEAM_LEAD" | "LEAD_TRAINEE" }>`
- `members: Array<{ uid: string, username: string }>`
- `gfiCount: number`
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `dailyTeamMetrics`

Document id:

- `${teamId}_${dateKey}`

Fields:

- `teamId: string`
- `teamName: string`
- `platform: "WEB" | "ANDROID"`
- `dateKey: string` **(IST-normalized YYYY-MM-DD reporting day bucket)**
- `capturedAt: Timestamp`
- `unansweredIssuesCount: number` **(visible team issues whose last comment was more than 1 day old at capture time; last comment must still fall within the 15-day fetch window)**
- `maxWaitingDays: number`
- `schemaVersion: number`

### `dailyDiscussionMetrics`

Document id:

- `${platform}_${dateKey}`

Fields:

- `platform: "WEB" | "ANDROID"`
- `dateKey: string` **(IST-normalized YYYY-MM-DD reporting day bucket)**
- `capturedAt: Timestamp`
- `unansweredDiscussionsCount: number`
- `schemaVersion: number`

### `teams/{teamId}/actionItems`

Subcollection of `teams`. Document id:

- the stable rule key, e.g. `gfi-shortfall`

Fields:

- `teamKey: string`
- `teamName: string`
- `ruleKey: string`
- `message: string`
- `priority: "high" | "medium" | "low"`
- `reason: string`
- `detectedAt: Timestamp`
- `lastDetectedAt: Timestamp`
- `firstNotifiedAt: Timestamp | null`
- `lastNotifiedAt: Timestamp | null`
- `notificationCount: number`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `schemaVersion: number`

### `notificationDeliveries`

Document id:

- `${kind}__${periodKey}__${teamKey}__${channel}` **(also the idempotency key, e.g. `weekly_action_items_digest__2026-11-02__CORE__EMAIL`)**

Fields:

- `kind: string`
- `channel: "EMAIL" | "IN_APP"`
- `teamKey: string`
- `periodKey: string` **(IST week-start date key for weekly digests)**
- `actionItemIds?: string[]` **(exact action-item document ids included in the delivery; defaults to an empty array when absent)**
- `recipientUids: string[]`
- `itemCount: number`
- `status: "SENT" | "SKIPPED" | "FAILED"`
- `error: string | null`
- `recordedAt: Timestamp`
- `schemaVersion: number`

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
- `schemaVersion: number`

### `orgMeta`

Document id:

- platform string (`WEB` or `ANDROID`)

Fields:

- `orgMembers: string[]`
- `collaborators: Array<{ login: string, permission: string }>`
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `userJourneyProgress`

Document id:

- `uid` of the user who owns the journey progress.

Fields:

- `createdAt: Timestamp`
- `derivedState: Record<string, { completed: boolean, completedAt: Timestamp | null, sourceUrl: string | null }>`
- `manualProgress: Record<string, { completed: boolean, completedAt: Timestamp | null }>`
- `platform: "WEB" | "ANDROID"`
- `updatedAt: Timestamp`
- `schemaVersion: number`

### `teamReviewers`

Document id:

- platform string (e.g. `WEB` or `ANDROID`)

Fields:

- `teams: Array<{ teamSlug: string, teamName: string, description: string, members: Array<{ username: string, avatarUrl: string }> }>`
- `lastUpdated: Timestamp`
- `schemaVersion: number`

All reviewer-report collections below are platform-scoped. Document ids carry a platform prefix (or are the platform itself for singleton docs), and every document stores a `platform` field. Web and Android reviewer data can therefore coexist in the same collections without future migrations.

GitHub logins used in reviewer document ids, aggregation keys, and `reviewerLogin` fields are normalized with `trim().toLowerCase()` at ingestion, so login capitalization differences cannot create duplicate reviewer documents or split metrics.

### `reviewers`

Document id:

- `${platform}_${normalizedGithubLogin}` (e.g. `WEB_octocat`, `ANDROID_octocat`)

Fields:

- `platform: "WEB" | "ANDROID"`
- `teams: string[]`
- `pendingReviews: Array<{ prNumber: number, title: string, url: string, assignedAt: string }>`
- `completedReviews?: number`
- `reviewedPrCount?: number`
- `completedReviewSubmissions?: number`
- `approvedPrCount?: number`
- `authoredPrCount?: number`
- `avgReviewTimeHours?: number | null`
- `avgTimeToApprovalHours?: number | null`
- `avgReviewRoundsBeforeApproval?: number | null`
- `avgCommentsPerReview?: number | null`
- `avgReviewsPerWeek?: number | null`
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `reviewCycles`

Document id:

- `${platform}_${normalizedReviewerLogin}:${prNumber}:${assignedAt}`

Fields:

- `platform: "WEB" | "ANDROID"`
- `reviewerLogin: string` — normalized GitHub login
- `prNumber: number`
- `prTitle: string`
- `prUrl: string`
- `assignedAt: string`
- `completedAt: string`
- `durationMs: number`
- `reviewRoundsBeforeApproval: number | null`
- `commentCount: number`
- `reviewSubmissionCount: number`
- `approvedAt: string | null`
- `approvalDurationMs: number | null`
- `prAdditions: number | null`
- `schemaVersion: number`

### `reviewCycleAnalytics`

Document id:

- platform string (e.g. `WEB` or `ANDROID`)

Fields:

- `platform: "WEB" | "ANDROID"`
- `weeklyReviews: Array<{ weekStart: string, reviews: number }>`
- `monthlyUniqueReviewers: Array<{ month: string, uniqueReviewers: number }>`
- `topApprovers: Array<{ username: string, approvals: number, sharePct: number }>`
- `prSizeScatter: Array<{ prNumber: number, additions: number, reviewTimeHours: number }>` — capped to the 400 most recent PRs
- `totalApprovals: number`
- `computedAt: Timestamp`
- `schemaVersion: number`

The snapshot holds only the dashboard payload. Incremental merge state lives in `reviewCyclePrStats`, `reviewCycleMonthlyReviewers`, and `reviewerCycleAggregates`, so this document cannot grow with review history.

### `reviewCyclePrStats`

Document id:

- `${platform}_${prNumber}`

Fields:

- `platform: "WEB" | "ANDROID"`
- `prNumber: number`
- `additions: number | null`
- `firstAssignedAt: string | null` — earliest review assignment on the PR
- `lastApprovedAt: string | null` — latest approval by any reviewer
- `reviewers: Record<string, { weekStart: string, month: string, submissions: number, roundsBeforeApproval: number | null, comments: number, approved: boolean }>` — one fact per reviewer who touched the PR; owns reviewer-PR dedupe
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `reviewCycleMonthlyReviewers`

Document id:

- `${platform}_${YYYY-MM}` month key

Fields:

- `platform: "WEB" | "ANDROID"`
- `month: string`
- `logins: string[]` — distinct reviewers who submitted a review that month
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `reviewerCycleAggregates`

Document id:

- `${platform}_${normalizedGithubLogin}`

Fields:

- `platform: "WEB" | "ANDROID"`
- Incremental reviewer cycle counters and totals used to update reviewer metrics without scanning `reviewCycles`
- `completedReviews: number`
- `reviewedPrCount: number`
- `approvedPrCount: number`
- `totalReviewTimeMs: number`
- `totalRoundsBeforeApproval: number`
- `totalComments: number`
- `completedReviewSubmissions: number`
- `totalApprovalDurationMs: number`
- `approvalsWithDuration: number`
- `activeWeeks: string[]` — bounded by the number of weeks, not PRs
- `lastUpdated: Timestamp`
- `schemaVersion: number`

### `reviewCycleBackfill`

Document id:

- platform string (e.g. `WEB` or `ANDROID`)

Fields:

- `platform: "WEB" | "ANDROID"`
- `windowStart: string`
- `windowEnd: string`
- `targetEnd: string`
- `processedPrNumbers: number[]`
- `updatedAt: Timestamp`
- `schemaVersion: number`

## Derived Type Summary

Normalized app-layer models convert Firestore timestamps to JavaScript `Date` values as follows:

- `users.createdAt -> Date`
- `users/{uid}/notifications.createdAt -> Date`
- `memberAccessRequests.createdAt -> Date`
- `teams.lastUpdated -> Date`
- `actionItems.detectedAt -> Date`
- `actionItems.lastDetectedAt -> Date`
- `actionItems.firstNotifiedAt -> Date | null`
- `actionItems.lastNotifiedAt -> Date | null`
- `actionItems.createdAt -> Date`
- `actionItems.updatedAt -> Date`
- `notificationDeliveries.recordedAt -> Date`
- `dailyTeamMetrics.capturedAt -> Date`
- `dailyDiscussionMetrics.capturedAt -> Date`
- `dataJobRuns.startedAt -> Date`
- `dataJobRuns.finishedAt -> Date | null`
- `orgMeta.lastUpdated -> Date`
- `userJourneyProgress.createdAt -> Date`
- `userJourneyProgress.updatedAt -> Date`
- `userJourneyProgress.derivedState[*].completedAt -> Date | null`
- `userJourneyProgress.manualProgress[*].completedAt -> Date | null`
- `teamReviewers.lastUpdated -> Date`
- `reviewers.lastUpdated -> Date`
- `reviewCyclePrStats.lastUpdated -> Date`
- `reviewCycleMonthlyReviewers.lastUpdated -> Date`
- `reviewerCycleAggregates.lastUpdated -> Date`
- `reviewCycleBackfill.updatedAt -> Date`

Notes:

- `reviewCycleAnalytics` is returned as the stored analytics payload (including `schemaVersion`); its `computedAt` Firestore timestamp is not exposed by the normalizer.
- Archived issues and discussions normalize stored timestamps to ISO strings in their app-layer records.
- Review cycle records store `assignedAt`, `completedAt`, and optional `approvedAt` as ISO strings rather than Firestore timestamps.
