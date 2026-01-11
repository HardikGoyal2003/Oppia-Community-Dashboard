"use client";

import { useEffect, useState } from "react";
import { UserRole } from "@/lib/auth/auth.types";

type User = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

const ROLES: UserRole[] = [
  "CONTRIBUTOR",
  "TEAM_MEMBER",
  "TEAM_LEAD",
  "TECH_LEAD",
];

export default function TechLeadView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const handleRoleChange = async (
    userId: string,
    role: UserRole
  ) => {
    setUpdatingId(userId);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: userId, role }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      setUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, role } : u
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <p className="p-6">Loading users...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">
        User Role Management
      </h1>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
            </tr>
          </thead>

          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <select
                    value={user.role}
                    disabled={updatingId === user.id}
                    onChange={e =>
                      handleRoleChange(
                        user.id,
                        e.target.value as UserRole
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
    </div>
  );
}
