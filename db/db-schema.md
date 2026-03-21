# DB Schema

This document describes the Firestore schema currently implied by the codebase.

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
- `team: string | null` (Can be null when a new user sign-in on the dashboard)
- `platform: "WEB" | "ANDROID" | null` (Can be null when a new user sign-in on the dashboard)
- `createdAt: Timestamp`

Subcollections:

#### `users/{uid}/notifications`

Document id:

- auto-generated notification id

Fields:

- `message: string`
- `read: boolean`
- `createdAt: Timestamp`

### `announcements`

Document id:

- `global-banner`

Fields:

- `title: string`
- `message: string`
- `isEnabled: boolean`
- `updatedAt: Timestamp`

### `archivedIssues`

Document id:

- `${platform}_${issueNumber}`

Fields:

- `issueNumber: number`
- `issueUrl: string`
- `issueTitle: string`
- `isArchived: true` **(Audit if this field is needed or not)**
- `lastCommentCreatedAt: string` **(Needs to changed into Timestamp type from the string)**
- `linkedProject: string`
- `platform: "WEB" | "ANDROID"`

Notes:

- this schema is based on the dashboard `Issue` shape plus the `platform` field
- `lastCommentCreatedAt` is currently stored as a string, not a Firestore timestamp

### `memberAccessRequests`

Document id:

- auto-generated request id

Fields:

- `email: string`
- `platform: "WEB" | "ANDROID"`
- `team: string`
- `role: string`
- `note: string`
- `username: string`
- `status: "PENDING" | "ACCEPTED" | "REJECTED"`
- `createdAt: Timestamp`

## Derived Type Summary

Normalized app-layer models convert Firestore timestamps as follows:

- `users.createdAt -> Date`
- `users/{uid}/notifications.createdAt -> Date`
- `memberAccessRequests.createdAt -> Date`
- `announcements/global-banner.updatedAt -> Date`
