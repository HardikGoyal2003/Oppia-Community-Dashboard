import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import {
  getPendingMemberAccessRequestsByPlatformAndRoles,
  resolveMemberAccessRequest,
} from "@/db/member-access-requests/member-access-request.db";
import { updateUserRoleAndTeamWithNotificationByUid } from "@/db/users/users.db";
import { appendUserNotificationByUid } from "@/db/users/notifications/notifications.db";
import { UserRole } from "@/lib/auth/auth.types";
import { isValidUserRole } from "@/lib/utils/roles.utils";
import {
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/db/db.errors";

const TEAM_LEAD_MANAGEABLE_ROLES = ["TEAM_MEMBER", "LEAD_TRAINEE"];

function canManageTeamRequests(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

function getPromotionMessage(role: UserRole, team: string): string {
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

function getDeclineMessage(
  reason: string,
  changedByGithubUsername?: string,
): string {
  const actor = changedByGithubUsername ?? "Team Lead";

  return [
    `Thank you for your request. ${actor} reviewed it and we are unable to approve it at this moment.`,
    `Reason: ${reason}`,
    "Please refine your request and apply again. We appreciate your interest in contributing with us.",
  ].join("\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user ||
    !canManageTeamRequests(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!session.user.team || !session.user.platform) {
    return NextResponse.json(
      { error: "Your team assignment is incomplete." },
      { status: 400 },
    );
  }

  const requests = await getPendingMemberAccessRequestsByPlatformAndRoles(
    session.user.platform,
    TEAM_LEAD_MANAGEABLE_ROLES,
    session.user.team,
  );

  return NextResponse.json({
    pending: requests,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user ||
    !canManageTeamRequests(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() : "";
  const decision =
    typeof body.decision === "string" ? body.decision.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!requestId || !decision || !["ACCEPT", "DECLINE"].includes(decision)) {
    return NextResponse.json(
      { error: "Invalid requestId/decision payload." },
      { status: 400 },
    );
  }

  if (decision === "DECLINE" && !reason) {
    return NextResponse.json(
      { error: "Decline reason is required." },
      { status: 400 },
    );
  }

  try {
    const request = await resolveMemberAccessRequest(requestId, decision);

    if (!TEAM_LEAD_MANAGEABLE_ROLES.includes(request.role)) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to resolve requests for this role.",
        },
        { status: 403 },
      );
    }

    if (request.team !== session.user!.team) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to resolve requests for another team.",
        },
        { status: 403 },
      );
    }

    if (decision === "ACCEPT") {
      if (!isValidUserRole(request.role)) {
        return NextResponse.json(
          { error: "Invalid role in request." },
          { status: 400 },
        );
      }

      await updateUserRoleAndTeamWithNotificationByUid(
        request.userId,
        request.role,
        request.team,
        request.username,
        getPromotionMessage(request.role, request.team),
      );
    } else {
      await appendUserNotificationByUid(
        request.userId,
        getDeclineMessage(reason, session.user?.githubUsername),
      );
    }
  } catch (error) {
    if (error instanceof DbNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof DbInvalidStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  return NextResponse.json({ success: true });
}
