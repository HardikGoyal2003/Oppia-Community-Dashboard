import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import type { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { DbNotFoundError } from "@/lib/errors";
import {
  getUserById,
  getUsersByPlatform,
  getUsersByTeam,
  type UserRecord,
  updateUserPlatformByUid,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";

export type ManagedUser = Pick<
  UserRecord,
  "id" | "fullName" | "email" | "githubUsername" | "platform" | "role" | "team"
>;

export type TeamMemberSummary = Pick<
  UserRecord,
  "id" | "fullName" | "githubUsername" | "platform" | "role" | "team"
>;

type UserUpdateActor = {
  role: UserRole;
  team: string | null;
  githubUsername?: string;
};

/**
 * Builds the notification message sent after a user's access details change.
 *
 * @param role The new role.
 * @param team The new team, or null when unassigned.
 * @param reason The reason provided for the change.
 * @param changedByGithubUsername The GitHub username of the actor.
 * @param defaultActorLabel The fallback actor label when no username is available.
 * @returns The formatted notification message.
 */
function getUserAccessUpdatedMessage(
  role: UserRole,
  team: string | null,
  reason: string,
  changedByGithubUsername: string | undefined,
  defaultActorLabel: string,
): string {
  const roleLabel = getKnownRoleDisplayLabel(role);
  const teamLabel = team ?? "Unassigned";
  const actor = changedByGithubUsername ?? defaultActorLabel;

  return [
    `Your access details were updated by ${actor}.`,
    `New role: ${roleLabel}`,
    `New team: ${teamLabel}`,
    `Reason: ${reason}`,
  ].join("\n");
}

/**
 * Selects the user fields required by the user-role manager UI.
 *
 * @param user The full user record.
 * @returns The minimal managed user payload.
 */
function toManagedUser(user: UserRecord): ManagedUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    githubUsername: user.githubUsername,
    platform: user.platform,
    role: user.role,
    team: user.team,
  };
}

/**
 * Selects the member fields required by the team-members UI.
 *
 * @param member The full team member record.
 * @returns The minimal team member payload.
 */
function toTeamMemberSummary(member: UserRecord): TeamMemberSummary {
  return {
    id: member.id,
    fullName: member.fullName,
    githubUsername: member.githubUsername,
    platform: member.platform,
    role: member.role,
    team: member.team,
  };
}

/**
 * Lists users for admin management, optionally filtered by platform.
 *
 * @param platform The optional platform filter.
 * @returns Managed user summaries.
 */
export async function getManagedUsers(
  platform?: ContributionPlatform,
): Promise<ManagedUser[]> {
  const users = await getUsersByPlatform(platform);
  return users.map(toManagedUser);
}

/**
 * Updates a user's role and team as an admin action and notifies the user.
 *
 * @param input The update payload and actor context.
 * @returns A promise that resolves when the update completes.
 */
export async function updateManagedUserAccess(input: {
  uid: string;
  role: UserRole;
  team: string | null;
  githubUsername: string;
  reason: string;
  actor: UserUpdateActor;
}): Promise<void> {
  await updateUserRoleAndTeamWithNotificationByUid(
    input.uid,
    input.role,
    input.team,
    input.githubUsername,
    getUserAccessUpdatedMessage(
      input.role,
      input.team,
      input.reason,
      input.actor.githubUsername,
      "Admin",
    ),
    {
      role: input.actor.role,
      team: input.actor.team,
    },
  );
}

/**
 * Updates the signed-in user's contribution platform.
 *
 * @param uid The user id to update.
 * @param platform The selected contribution platform.
 * @returns A promise that resolves when the update completes.
 */
export async function updateUserPlatform(
  uid: string,
  platform: ContributionPlatform,
): Promise<void> {
  await updateUserPlatformByUid(uid, platform);
}

/**
 * Lists active (non-alumni) members of a team for team management.
 *
 * @param team The team key.
 * @returns Team member summaries.
 */
export async function getTeamMembers(
  team: string,
): Promise<TeamMemberSummary[]> {
  const allMembers = await getUsersByTeam(team);
  return allMembers
    .filter((member) => member.role !== "ALUMNI")
    .map(toTeamMemberSummary);
}

/**
 * Updates a team member's role/team within the caller's team and notifies them.
 *
 * @param input The update payload and actor context.
 * @returns A promise that resolves when the update completes.
 * @throws {DbNotFoundError} When the target user does not exist.
 */
export async function updateTeamMemberAccess(input: {
  uid: string;
  role: UserRole;
  team: string;
  reason: string;
  actor: UserUpdateActor;
}): Promise<void> {
  const target = await getUserById(input.uid);

  if (!target) {
    throw new DbNotFoundError("User");
  }

  await updateUserRoleAndTeamWithNotificationByUid(
    input.uid,
    input.role,
    input.team,
    target.githubUsername,
    getUserAccessUpdatedMessage(
      input.role,
      input.team,
      input.reason,
      input.actor.githubUsername,
      "Team Lead",
    ),
    {
      role: input.actor.role,
      team: input.actor.team,
    },
  );
}
