# AGENTS.md

## Oppia Community Dashboard – AI Coding Agent Guide

This document provides **quick context for AI coding agents** working on the Oppia Community Dashboard repository.  
Agents should read this file before making any changes.

The goal is to ensure that automated changes **respect project architecture, data models, and conventions**.

---

# Project Overview

The **Oppia Community Dashboard** is a tool designed to help manage and grow the Oppia contributor community.

It allows maintainers to:

- Track community activity
- Help new contributors onboard
- Manage contributor roles
- Monitor unanswered GitHub issues
- Support potential contributors

The dashboard is initially intended for **internal Oppia maintainers**, but is designed to eventually support **public contributors**.

---

## Roles & Views

| Role              | View                                             |
| ----------------- | ------------------------------------------------ |
| Contributor       | `features/dashboard/views/contributor-view/`     |
| Team Member       | placeholder in `app/dashboard/overview/page.tsx` |
| Team Lead         | `features/dashboard/views/team-lead-view/`       |
| Tech Lead (Admin) | `features/dashboard/views/tech-lead-view/`       |

**Rule:** Never bypass role-based logic.

---

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Zustand
- **UI:** TailwindCSS + shadcn/ui
- **Auth:** NextAuth
- **Database:** Firestore (via services only)
- **Deployment:** Vercel

---

## Architecture

**Layered:** UI/Hooks/Stores → API Services → API → DB Layer (\*.db.ts) → Firestore

- UI components **cannot access Firestore directly**
- Business logic belongs in **services**
- Reuse **components/ui/** whenever possible

---

## Key Directories

- `app/dashboard/` – page entry points for the dashboard
- `features/dashboard/` – feature-specific views, tabs, shared components, hooks, stores, services
- `db/` – Firestore services (\*.db.ts)
- `lib/auth/` – authentication and role utilities
- `lib/firebase/` – Firebase clients (`firebase-admin.ts`, `firebase.client.ts`)
- `lib/github/` – GitHub fetcher and types
- `lib/utils/` – helper functions
- `lib/config/` – global constants and env helpers (`lib/constants.ts` no longer exists)
- `lib/action-items/` – action-item sync/status service (derived from team-report rules)
- `lib/notifications/` – notification channels (in-app, email) and digest templates
- `features/dashboard/shared/action-items/` – client types, API service, and hook for action items
- `components/ui/` – reusable UI primitives
- `components/layout/sidebar/` – sidebar components, hooks, and store
- `components/layout/` – other layout components (navbar, loading indicator)

---

## Firestore Collections

- **users:** id, githubUsername, role, createdAt
- **archivedIssues:** id, issueNumber, archivedBy, archivedAt
- **memberRequestAccess:** id, userId, requestedRole, status, createdAt
- **teams/{teamId}/actionItems:** id (rule key), teamKey, ruleKey, status (OPEN/RESOLVED), escalationLevel, timestamps
- **notificationDeliveries:** id (`${kind}__${periodKey}__${teamKey}__${channel}`), status, recipientUids (weekly/escalation idempotency log)

**Rule:** Respect structure and roles.

---

## Action Items, Digest & Escalation

- Action items come from team-report rules (`getNextSteps()` in `lib/team-reports/`, each step carries a stable `ruleKey`) and are persisted by `syncActionItems()` in `lib/action-items/`. Items live at `teams/{teamId}/actionItems/{ruleKey}`.
- **Status is fully derived — no human writes it.** The sync engine is the only writer: a firing rule creates/refreshes an `OPEN` item; an item whose rule has been silent for `ACTION_ITEM_RESOLVE_AFTER_DAYS` (7) auto-resolves itself. There is no review API and the UI list is read-only.
- Sync runs as a step inside the digest and escalation crons, and on `GET /api/action-items` — there is no standalone sync cron.
- Weekly digest cron: `/api/cron/send-action-item-digest` (Mondays 08:30 IST). Sends through registered channels in `lib/notifications/channels/` — in-app bell plus Resend email. Deliveries are idempotent per (week, team, channel) via `notificationDeliveries`.
- Escalation: `/api/cron/escalate-action-items` runs daily (09:30 IST) but only nudges when an item is due — open, already digest-notified, still detected, and untouched for `ACTION_ITEM_ESCALATION_DAYS` (default 3) since the last nudge. Levels escalate on each boundary; nudges go to leads only. Idempotent per (day, team, channel).
- **Adding a channel** (Google Chat, Slack, ...): implement `NotificationChannel` from `lib/domain/notifications.types.ts`, register it in `lib/notifications/channels/index.ts`. Nothing else changes.
- Lead email overrides: `lib/config/lead-emails.ts` maps GitHub username → email for leads whose user record has none.
- Email env: `RESEND_API_KEY`, `ACTION_ITEMS_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` (for absolute links); toggles `ACTION_ITEM_EMAIL_ENABLED`, `ACTION_ITEMS_DIGEST_ENABLED`, `ACTION_ITEM_ESCALATION_ENABLED`, `ACTION_ITEM_ESCALATION_DAYS`. Set these in `.env.local` yourself; agents must not edit env files.

---

## Development Rules

- **Server Components by default**; `"use client"` only for browser-specific logic
- Use existing **hooks** and **stores**; extend before creating new ones
- Strict TypeScript typing; avoid `any` and `unknown`
- Validate API routes and **avoid exposing secrets**
- Do not modify or read environment variables (`.env` or `.env.local`)

---

## GitHub Integration

- Fetch via `lib/github/scripts/github.fetcher.ts`
- Handle API errors & rate limits safely

---

## Common Pitfalls

- **Direct Firestore in UI** → always use service
- **Duplicate UI components** → always check `components/ui/` first
- **Breaking role-based access** → follow existing permissions

If anything above is unclear or you want the agent to include examples for
editing/running a specific subsystem (backend handler, a frontend component, or
a test), tell me which area and I will expand or iterate.
