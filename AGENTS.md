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

| Role | View |
|------|------|
| Contributor | contributor.view.tsx |
| Team Member | team-member.view.tsx |
| Team Lead | team-lead.view.tsx |
| Tech Lead (Admin) | tech-lead.view.tsx |

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

**Layered:** UI → Hooks/Stores → Server Actions / API Routes → Services (business logic) → DB Layer (*.db.ts) → Firestore  

- UI components **cannot access Firestore directly**  
- Business logic belongs in **services**  
- Reuse **components/ui/** whenever possible  

---

## Key Directories

- `app/dashboard/` – page entry points for the dashboard  
- `features/dashboard/` – feature-specific views, tabs, shared components, hooks, stores, services  
- `db/` – Firestore services (*.db.ts)
- `lib/auth/` – authentication and role utilities  
- `lib/firebase/` – Firebase clients (`firebase-admin.ts`, `firebase.client.ts`)  
- `lib/github/` – GitHub fetcher and types  
- `lib/utils/` – helper functions 
- `lib/constants.ts` – global constants  
- `components/ui/` – reusable UI primitives  
- `components/layout/sidebar/` – sidebar components, hooks, and store  
- `components/layout/` – other layout components (navbar, loading indicator)  

---

## Firestore Collections

- **users:** id, githubUsername, role, createdAt  
- **archivedIssues:** id, issueNumber, archivedBy, archivedAt  
- **memberRequestAccess:** id, userId, requestedRole, status, createdAt  

**Rule:** Respect structure and roles.

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