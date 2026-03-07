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

**Layered:** UI → Hooks/Stores → Services → API → Firestore  

- UI components **cannot access Firestore directly**  
- Business logic belongs in **services**  
- Reuse **components/ui/** whenever possible  

---

## Key Directories

- `app/dashboard/` – views, hooks, stores, services, tabs, components  
- `lib/db/` – Firestore services (`users.service.ts`, `archived-issues.service.ts`)  
- `lib/auth/` – auth & role utilities  
- `lib/github/` – issue fetcher & formatter  
- `components/ui/` – reusable UI components  

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

- Fetch via `lib/github/scripts/github-issues.fetcher.ts`  
- Format via `lib/github/service/format-issues.service.ts`  
- Handle API errors & rate limits safely  

---

## Common Pitfalls

- **Direct Firestore in UI** → always use service  
- **Duplicate UI components** → always check `components/ui/` first  
- **Breaking role-based access** → follow existing permissions  

If anything above is unclear or you want the agent to include examples for
editing/running a specific subsystem (backend handler, a frontend component, or
a test), tell me which area and I will expand or iterate.