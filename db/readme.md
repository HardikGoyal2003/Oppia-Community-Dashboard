# Database Layer (`/db`)

This folder contains the **database access layer** for the application.

Its purpose is to **centralize all direct interactions with the database** (e.g., Firestore). Any file in this folder should only be responsible for **reading or writing data**, and **must not contain business logic**.

---

## Responsibilities

Files in this folder should:

* Execute **database queries**
* Perform **CRUD operations**
* Handle **data retrieval and persistence**
* Contain logic directly related to the **database schema**

Examples of valid responsibilities:

* Fetching a user by ID
* Saving an archived issue
* Creating a member access request
* Updating issue status in the database

---

## Non-Responsibilities

Files in this folder **must NOT**:

* Contain **business logic**
* Perform **authorization checks**
* Handle **UI logic**
* Contain **complex application rules**
* Trigger notifications or external services

Those responsibilities belong in the **`services/` layer**.

---

## Architecture Flow

The application follows a layered structure:

```
UI (React Components)
        ↓
API Routes
        ↓
Services (business logic)
        ↓
DB Layer (this folder)
        ↓
Database
```

Example flow:

```
IssueCard.tsx
   ↓
route.ts
   ↓
archiveIssueService()
   ↓
archiveIssue.db.ts
   ↓
Database
```

---

## File Naming Convention

Each file represents a **database domain** and should follow the naming convention:

```
<domain>.db.ts
```

Examples:

```
users.db.ts
issues.db.ts
archived-issues.db.ts
member-request.db.ts
```

---


## Where Business Logic Goes

Any **application rules** should live in the `services/` directory.

Example:

```ts
// services/user.service.ts

import { getUserById } from "@/db/users.db";

export async function getUserProfile(userId: string) {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
```

---

## Why This Layer Exists

Keeping database logic isolated provides several benefits:

* **Separation of concerns**
* **Cleaner architecture**
* **Easier testing**
* **Reusable queries**
* **Simpler database migrations**

If the database changes in the future, updates should primarily occur **inside this folder only**.

---

## Guideline for Contributors

Before adding new code:

* If your code **queries the database**, place it here.
* If your code **contains application rules**, place it in `services/`.
* If your code **handles UI behavior**, place it in `components/` or `features/`.

