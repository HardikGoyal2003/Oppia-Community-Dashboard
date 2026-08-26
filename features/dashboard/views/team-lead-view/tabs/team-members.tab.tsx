"use client";

import { useEffect, useState } from "react";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import { TEAM_LEAD_ASSIGNABLE_ROLES } from "@/lib/auth/roles";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config";
import { UserUpdateReasonModal } from "../../tech-lead-view/components/user-update-reason-modal";
import { formatDisplayValue } from "@/lib/utils/display.utils";

type TeamMember = {
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

function getDisplayRole(role: UserRole): UserRole {
  return role === "SUPER_ADMIN" ? "ADMIN" : role;
}

function isManagedRole(role: UserRole): boolean {
  return role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "TEAM_LEAD";
}

function getTeamsForPlatform(platform: ContributionPlatform | null): string[] {
  if (platform === "ANDROID") {
    return Object.keys(ANDROID_TEAMS);
  }

  return Object.keys(WEB_TEAMS);
}

export function TeamMembersTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );

  useEffect(() => {
    async function loadMembers() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/team-members");
        if (!res.ok) {
          const payload = (await res.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load team members.");
        }
        const data = (await res.json()) as TeamMember[];
        setMembers(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load team members.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadMembers();
  }, []);

  const openUpdateModal = (
    member: TeamMember,
    role: UserRole,
    team: string | null,
  ) => {
    if (member.role === role && member.team === team) {
      return;
    }

    setPendingUpdate({
      userId: member.id,
      userName: member.fullName || member.email,
      githubUsername: member.githubUsername,
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
      const res = await fetch("/api/team-members", {
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
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update member.");
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.id === pendingUpdate.userId
            ? {
                ...member,
                role: pendingUpdate.role,
                team: pendingUpdate.team,
                githubUsername: pendingUpdate.githubUsername,
              }
            : member,
        ),
      );

      closeUpdateModal();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update member.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <p className="p-6">Loading team members...</p>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Team Members</h1>

      {members.length === 0 ? (
        <div className="rounded border bg-white p-6 text-center text-gray-500">
          No members found in your team.
        </div>
      ) : (
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
              {members.map((member, index) => (
                <tr key={member.id} className="border-b">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">{member.fullName}</td>
                  <td className="p-3">{member.email}</td>
                  <td className="p-3">{member.githubUsername}</td>
                  <td className="p-3">
                    {isManagedRole(member.role) ? (
                      <select
                        value={member.team ?? ""}
                        disabled={updatingId === member.id}
                        onChange={(e) =>
                          openUpdateModal(
                            member,
                            member.role,
                            e.target.value || null,
                          )
                        }
                        className="border rounded px-2 py-1 disabled:opacity-50"
                      >
                        {getTeamsForPlatform(member.platform).map((team) => (
                          <option key={team} value={team}>
                            {formatDisplayValue(team)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm">
                        {formatDisplayValue(member.team)}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {isManagedRole(member.role) ? (
                      <select
                        value={getDisplayRole(member.role)}
                        disabled={updatingId === member.id}
                        onChange={(e) =>
                          openUpdateModal(
                            member,
                            e.target.value as UserRole,
                            member.team,
                          )
                        }
                        className="border rounded px-2 py-1 disabled:opacity-50"
                      >
                        {TEAM_LEAD_ASSIGNABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {getKnownRoleDisplayLabel(role)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm">
                        {getKnownRoleDisplayLabel(getDisplayRole(member.role))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
