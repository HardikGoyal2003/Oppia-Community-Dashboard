import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import type { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isAssignableUserRole } from "@/lib/auth/roles";
import { DbValidationError } from "@/lib/errors";
import {
  getMemberAccessRequestById as getMemberAccessRequestByIdRecord,
  getPendingMemberAccessRequestsByPlatformAndRoles as getPendingMemberAccessRequestsByPlatformAndRolesRecord,
  resolveMemberAccessRequest as resolveMemberAccessRequestRecord,
  submitMemberAccessRequest as submitMemberAccessRequestRecord,
} from "@/db/member-access-requests/member-access-requests.db";
import type {
  MemberAccessDecision,
  MemberAccessRequestRecord,
} from "@/db/member-access-requests/member-access-requests.types";

const ADMIN_MANAGEABLE_ROLES = ["TEAM_LEAD", "ADMIN"];
const TEAM_LEAD_MANAGEABLE_ROLES = ["TEAM_MEMBER", "LEAD_TRAINEE"];

type ResolveActor = {
  role: UserRole;
  team: string | null;
  platform: ContributionPlatform | null;
  githubUsername: string;
};

type SubmitMemberAccessRequestInput = {
  userId: string;
  platform: ContributionPlatform;
  team: string;
  role: string;
  note: string;
  username: string;
};

/**
 * Builds the approval notification message for an admin-managed request.
 *
 * @param role The approved role.
 * @param team The approved team.
 * @returns The approval notification message.
 */
function getAdminPromotionMessage(role: UserRole, team: string): string {
  const roleLabel = getKnownRoleDisplayLabel(role);

  switch (role) {
    case "TEAM_MEMBER":
      return `Great news! You are now a ${roleLabel} on ${team}. We're really happy to have you onboard.`;
    case "TEAM_LEAD":
      return `Amazing! You have been promoted to ${roleLabel} on ${team}. We're truly excited to have you leading with us onboard.`;
    case "ADMIN":
      return `Outstanding! You have been promoted to ${roleLabel} on ${team}. We're incredibly grateful and thrilled to have you onboard in this key role.`;
    default:
      return `Welcome! Your access request has been approved and your role is now ${roleLabel} on ${team}. We're happy to have you onboard.`;
  }
}

/**
 * Builds the approval notification message for a team-lead-managed request.
 *
 * @param role The approved role.
 * @param team The approved team.
 * @returns The approval notification message.
 */
function getTeamPromotionMessage(role: UserRole, team: string): string {
  const roleLabel = getKnownRoleDisplayLabel(role);

  switch (role) {
    case "TEAM_MEMBER":
      return `Great news! You are now a ${roleLabel} on ${team}. We're really happy to have you onboard.`;
    case "LEAD_TRAINEE":
      return `Amazing! You have been promoted to ${roleLabel} on ${team}. We're truly excited to have you leading with us onboard.`;
    default:
      return `Welcome! Your access request has been approved and your role is now ${roleLabel} on ${team}. We're happy to have you onboard.`;
  }
}

/**
 * Builds the decline notification message for a member-access request.
 *
 * @param reason The decline reason.
 * @param changedByGithubUsername The GitHub username of the actor.
 * @returns The decline notification message.
 */
function getDeclineMessage(
  reason: string,
  changedByGithubUsername: string,
): string {
  if (!changedByGithubUsername.trim()) {
    throw new DbValidationError(
      "githubUsername",
      "Actor GitHub username is required.",
    );
  }

  return [
    `Thank you for your request. ${changedByGithubUsername} reviewed it and we are unable to approve it at this moment.`,
    `Reason: ${reason}`,
    "Please refine your request and apply again. We appreciate your interest in contributing with us.",
  ].join("\n");
}

/**
 * Lists pending member-access requests manageable by admins.
 *
 * @param platform The optional platform filter.
 * @returns Pending admin-manageable requests.
 */
export async function listPendingAdminMemberAccessRequests(
  platform?: ContributionPlatform,
): Promise<MemberAccessRequestRecord[]> {
  return getPendingMemberAccessRequestsByPlatformAndRolesRecord(
    platform,
    ADMIN_MANAGEABLE_ROLES,
  );
}

/**
 * Lists pending member-access requests manageable by team leads.
 *
 * @param platform The platform to filter by.
 * @param team The team to filter by.
 * @returns Pending team-manageable requests.
 */
export async function listPendingTeamMemberAccessRequests(
  platform: ContributionPlatform,
  team: string,
): Promise<MemberAccessRequestRecord[]> {
  return getPendingMemberAccessRequestsByPlatformAndRolesRecord(
    platform,
    TEAM_LEAD_MANAGEABLE_ROLES,
    team,
  );
}

/**
 * Submits a new member-access request.
 *
 * @param input The request payload.
 * @returns A promise that resolves when the request has been submitted.
 */
export async function submitMemberAccessRequest(
  input: SubmitMemberAccessRequestInput,
): Promise<void> {
  await submitMemberAccessRequestRecord(input);
}

/**
 * Resolves a member-access request as an admin.
 *
 * @param input The resolution payload and actor context.
 * @returns A promise that resolves when the request has been resolved.
 */
export async function resolveAdminMemberAccessRequest(input: {
  requestId: string;
  decision: MemberAccessDecision;
  reason: string;
  actor: ResolveActor;
}): Promise<void> {
  const request = await getMemberAccessRequestByIdRecord(input.requestId);
  let notificationMessage: string;

  if (input.decision === "ACCEPT") {
    if (!isAssignableUserRole(request.role)) {
      throw new DbValidationError("role", "Invalid role in request.");
    }

    notificationMessage = getAdminPromotionMessage(request.role, request.team);
  } else {
    notificationMessage = getDeclineMessage(
      input.reason,
      input.actor.githubUsername,
    );
  }

  await resolveMemberAccessRequestRecord(
    input.requestId,
    input.decision,
    notificationMessage,
    {
      role: input.actor.role,
      team: input.actor.team,
      platform: input.actor.platform,
    },
  );
}

/**
 * Resolves a member-access request as a team lead.
 *
 * @param input The resolution payload and actor context.
 * @returns A promise that resolves when the request has been resolved.
 */
export async function resolveTeamMemberAccessRequest(input: {
  requestId: string;
  decision: MemberAccessDecision;
  reason: string;
  actor: ResolveActor;
}): Promise<void> {
  const request = await getMemberAccessRequestByIdRecord(input.requestId);
  let notificationMessage: string;

  if (input.decision === "ACCEPT") {
    if (!isAssignableUserRole(request.role)) {
      throw new DbValidationError("role", "Invalid role in request.");
    }

    notificationMessage = getTeamPromotionMessage(request.role, request.team);
  } else {
    notificationMessage = getDeclineMessage(
      input.reason,
      input.actor.githubUsername,
    );
  }

  await resolveMemberAccessRequestRecord(
    input.requestId,
    input.decision,
    notificationMessage,
    {
      role: input.actor.role,
      team: input.actor.team,
      platform: input.actor.platform,
    },
  );
}
