import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getPendingMemberAccessRequestsByPlatform,
  PendingMemberAccessRequestError,
  resolveMemberAccessRequest,
  submitMemberAccessRequest,
} from "@/db/member-access-request/member-access-request.db";
import {
  appendUserNotificationByUid,
  getUserById,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isValidUserRole } from "@/lib/utils/roles.utils";

function canManageRequests(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function getPromotionMessage(role: UserRole, team: string): string {
  const roleLabel = role.replace("_", " ");

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

function getDeclineMessage(reason: string): string {
  return [
    "Thank you for your request. At this moment, we are unable to approve it.",
    `Reason: ${reason}`,
    "Please refine your request and apply again. We appreciate your interest in contributing with us.",
  ].join("\n");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const platformParam = searchParams.get("platform");
  const platform =
    platformParam === "WEB" || platformParam === "ANDROID"
      ? (platformParam as ContributionPlatform)
      : undefined;

  const requests = await getPendingMemberAccessRequestsByPlatform(platform);
  return NextResponse.json({
    pending: requests,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const team = typeof body.team === "string" ? body.team.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!team || !role || !isValidUserRole(role)) {
    return NextResponse.json(
      { error: "Missing or invalid fields: team, role." },
      { status: 400 },
    );
  }

  const dbUser = await getUserById(session.user.id);
  const username = dbUser?.githubUsername;
  const platform = dbUser?.platform;

  if (!username) {
    return NextResponse.json(
      {
        error:
          "No GitHub username was found on your account. Please sign out and sign in again.",
      },
      { status: 400 },
    );
  }

  if (!platform) {
    return NextResponse.json(
      { error: "No contribution platform was found on your account." },
      { status: 400 },
    );
  }

  try {
    await submitMemberAccessRequest({
      userId: session.user.id,
      platform: platform as ContributionPlatform,
      team,
      role,
      note,
      username,
    });
  } catch (error) {
    if (error instanceof PendingMemberAccessRequestError) {
      return NextResponse.json(
        {
          error: "You already have a pending team access request.",
          pendingRequest: {
            role: error.request.role,
            team: error.request.team,
            note: error.request.note,
            createdAt: error.request.createdAt.toISOString(),
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit access request.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role)) {
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

  const request = await resolveMemberAccessRequest(requestId, decision);

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
      getDeclineMessage(reason),
    );
  }

  return NextResponse.json({ success: true });
}
