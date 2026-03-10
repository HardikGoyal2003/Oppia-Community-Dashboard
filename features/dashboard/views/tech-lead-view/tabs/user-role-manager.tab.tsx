"use client";

import { useEffect, useState } from "react";
import { UserRole } from "@/lib/auth/auth.types";
import { CONSTANTS } from "@/lib/constants";
import { UserUpdateReasonModal } from "../components/user-update-reason-modal";

type User = {
  id: string;
  fullName: string;
  email: string;
  githubUsername: string | null;
  role: UserRole;
  team: string | null;
};

type PendingUpdate = {
  userId: string;
  userName: string;
  githubUsername: string | null;
  role: UserRole;
  team: string | null;
};

const ROLES: UserRole[] = [
  "CONTRIBUTOR",
  "TEAM_MEMBER",
  "TEAM_LEAD",
  "ADMIN",
];

const TEAMS = Object.keys(CONSTANTS.WEB_TEAMS);

export function UserRoleManagerTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = (await res.json()) as User[];
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const openUpdateModal = (
    user: User,
    role: UserRole,
    team: string | null
  ) => {
    if (user.role === role && user.team === team) {
      return;
    }

    setPendingUpdate({
      userId: user.id,
      userName: user.fullName || user.email,
      githubUsername: user.githubUsername ?? null,
      role,
      team,
    });
  };

  const closeUpdateModal = () => {
    setPendingUpdate(null);
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

      setUsers(prev =>
        prev.map(user =>
          user.id === pendingUpdate.userId
            ? {
                ...user,
                role: pendingUpdate.role,
                team: pendingUpdate.team,
                githubUsername: pendingUpdate.githubUsername,
              }
            : user
        )
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
      <h1 className="mb-6 text-2xl font-semibold">
        User Role Manager
      </h1>

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
            {users.map((user, index) => (
              <tr key={user.id} className="border-b">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  {user.githubUsername ?? "-"}
                </td>
                <td className="p-3">
                  <select
                    value={user.team ?? ""}
                    disabled={updatingId === user.id}
                    onChange={e =>
                      openUpdateModal(
                        user,
                        user.role,
                        e.target.value || null
                      )
                    }
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {TEAMS.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={user.role}
                    disabled={updatingId === user.id}
                    onChange={e =>
                      openUpdateModal(
                        user,
                        e.target.value as UserRole,
                        user.team
                      )
                    }
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserUpdateReasonModal
        open={Boolean(pendingUpdate)}
        loading={Boolean(updatingId)}
        userName={pendingUpdate?.userName ?? "User"}
        onOpenChange={open => {
          if (!open) {
            closeUpdateModal();
          }
        }}
        onSubmit={submitUpdate}
      />
    </>
  );
}
