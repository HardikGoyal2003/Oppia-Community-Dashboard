"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import { ASSIGNABLE_USER_ROLES, USER_ROLES } from "@/lib/auth/roles";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config";
import { UserUpdateReasonModal } from "../components/user-update-reason-modal";
import { formatDisplayValue } from "@/lib/utils/display.utils";

type User = {
  id: string;
  fullName: string;
  email: string;
  githubUsername: string;
  platform: ContributionPlatform | null;
  role: UserRole;
  team: string | null;
};

type PendingUpdate = {
  userId: string;
  userName: string;
  githubUsername: string;
  role: UserRole;
  team: string | null;
};

type UsersResponse = {
  users: User[];
  nextCursor: string | null;
};

type UserFilters = {
  name: string;
  role: string;
  team: string;
};

const USERS_PAGE_SIZE = 10;
const DEFAULT_FILTERS: UserFilters = {
  name: "",
  role: "",
  team: "",
};

function getDisplayRole(role: UserRole): UserRole {
  return role === "SUPER_ADMIN" ? "ADMIN" : role;
}

function isManagedRole(role: UserRole): boolean {
  return role !== "SUPER_ADMIN";
}

function getTeamsForPlatform(platform: ContributionPlatform | null): string[] {
  if (platform === "ANDROID") {
    return Object.keys(ANDROID_TEAMS);
  }

  return Object.keys(WEB_TEAMS);
}

export function UserRoleManagerTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [platform, setPlatform] = useState<ContributionPlatform>("WEB");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<UserFilters>(DEFAULT_FILTERS);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );
  const currentCursor = pageCursors[pageIndex] ?? null;

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);

      try {
        const searchParams = new URLSearchParams({
          platform,
          limit: String(USERS_PAGE_SIZE),
        });

        if (appliedFilters.name) {
          searchParams.set("name", appliedFilters.name);
        }

        if (appliedFilters.role) {
          searchParams.set("role", appliedFilters.role);
        }

        if (appliedFilters.team) {
          searchParams.set("team", appliedFilters.team);
        }

        if (currentCursor) {
          searchParams.set("cursor", currentCursor);
        }

        const res = await fetch(`/api/users?${searchParams.toString()}`);
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = (await res.json()) as UsersResponse;
        setUsers(data.users);
        setNextCursor(data.nextCursor);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [platform, currentCursor, appliedFilters]);

  const openUpdateModal = (user: User, role: UserRole, team: string | null) => {
    if (user.role === role && user.team === team) {
      return;
    }

    setPendingUpdate({
      userId: user.id,
      userName: user.fullName || user.email,
      githubUsername: user.githubUsername,
      role,
      team,
    });
  };

  const closeUpdateModal = () => {
    setPendingUpdate(null);
  };

  const handlePlatformChange = (nextPlatform: ContributionPlatform) => {
    setPlatform(nextPlatform);
    setPageIndex(0);
    setPageCursors([null]);
    setNextCursor(null);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const updateFilter = (key: keyof UserFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    const nextFilters = {
      name: filters.name.trim(),
      role: filters.role,
      team: filters.team,
    };

    setAppliedFilters(nextFilters);
    setPageIndex(0);
    setPageCursors([null]);
    setNextCursor(null);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPageIndex(0);
    setPageCursors([null]);
    setNextCursor(null);
  };

  const goToPreviousPage = () => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    if (!nextCursor) {
      return;
    }

    setPageCursors((prev) => {
      if (prev[pageIndex + 1] === nextCursor) {
        return prev;
      }

      return [...prev.slice(0, pageIndex + 1), nextCursor];
    });
    setPageIndex((prev) => prev + 1);
  };

  const submitUpdate = async (reason: string) => {
    if (!pendingUpdate) return;

    setUpdatingId(pendingUpdate.userId);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: pendingUpdate.userId,
          role: pendingUpdate.role,
          team: pendingUpdate.team,
          githubUsername: pendingUpdate.githubUsername,
          reason,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update user.");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === pendingUpdate.userId
            ? {
                ...user,
                role: pendingUpdate.role,
                team: pendingUpdate.team,
                githubUsername: pendingUpdate.githubUsername,
              }
            : user,
        ),
      );

      closeUpdateModal();
    } catch (error) {
      console.error(error);
      alert("Failed to update user.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <p className="p-6">Loading users...</p>;
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">User Role Manager</h1>

      <div className="mb-4 flex gap-2">
        {(["WEB", "ANDROID"] as ContributionPlatform[]).map((option) => (
          <button
            key={option}
            className={`rounded border px-3 py-1 text-sm ${
              platform === option
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
            onClick={() => handlePlatformChange(option)}
          >
            {formatDisplayValue(option)}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              htmlFor="user-name-filter"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <Input
              id="user-name-filter"
              value={filters.name}
              onChange={(e) => updateFilter("name", e.target.value)}
              placeholder="Filter by name prefix"
            />
          </div>

          <div>
            <label
              htmlFor="user-role-filter"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Role
            </label>
            <select
              id="user-role-filter"
              value={filters.role}
              onChange={(e) => updateFilter("role", e.target.value)}
              className="h-9 w-full rounded-md border px-3 py-1 text-sm"
            >
              <option value="">All roles</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {getKnownRoleDisplayLabel(role)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="user-team-filter"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Team
            </label>
            <select
              id="user-team-filter"
              value={filters.team}
              onChange={(e) => updateFilter("team", e.target.value)}
              className="h-9 w-full rounded-md border px-3 py-1 text-sm"
            >
              <option value="">All teams</option>
              {getTeamsForPlatform(platform).map((team) => (
                <option key={team} value={team}>
                  {formatDisplayValue(team)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            Apply Filters
          </Button>
          <Button variant="ghost" onClick={resetFilters} disabled={loading}>
            Reset
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-100">
            <tr>
              <th className="p-3 text-left">S.No.</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">GitHub Username</th>
              <th className="p-3 text-left">Team</th>
              <th className="p-3 text-left">Role</th>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No users found for the selected filters.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">
                    {pageIndex * USERS_PAGE_SIZE + index + 1}
                  </td>
                  <td className="p-3">{user.fullName}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.githubUsername}</td>
                  <td className="p-3">
                    <select
                      value={user.team ?? ""}
                      disabled={
                        updatingId === user.id || !isManagedRole(user.role)
                      }
                      onChange={(e) =>
                        openUpdateModal(user, user.role, e.target.value || null)
                      }
                      className="border rounded px-2 py-1 disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {getTeamsForPlatform(user.platform).map((team) => (
                        <option key={team} value={team}>
                          {formatDisplayValue(team)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={getDisplayRole(user.role)}
                      disabled={
                        updatingId === user.id || !isManagedRole(user.role)
                      }
                      onChange={(e) =>
                        openUpdateModal(
                          user,
                          e.target.value as UserRole,
                          user.team,
                        )
                      }
                      className="border rounded px-2 py-1 disabled:opacity-50"
                    >
                      {ASSIGNABLE_USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {getKnownRoleDisplayLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing up to {USERS_PAGE_SIZE} users per page
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={goToPreviousPage}
            disabled={loading || pageIndex === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">Page {pageIndex + 1}</span>
          <Button
            variant="outline"
            onClick={goToNextPage}
            disabled={loading || !nextCursor}
          >
            Next
          </Button>
        </div>
      </div>

      <UserUpdateReasonModal
        open={Boolean(pendingUpdate)}
        loading={Boolean(updatingId)}
        userName={pendingUpdate?.userName ?? "User"}
        onOpenChange={(open) => {
          if (!open) {
            closeUpdateModal();
          }
        }}
        onSubmit={submitUpdate}
      />
    </>
  );
}
