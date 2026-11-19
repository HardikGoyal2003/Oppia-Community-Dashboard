import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isAssignableUserRole } from "@/lib/auth/roles";
import {
  DbAuthorizationError,
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
  PendingMemberAccessRequestError,
} from "@/lib/errors";
import {
  listPendingAdminMemberAccessRequests,
  resolveAdminMemberAccessRequest,
  submitMemberAccessRequest,
} from "@/lib/member-access-requests/member-access-requests.service";

function canManageRequests(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
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

  const requests = await listPendingAdminMemberAccessRequests(platform);
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

  if (!team || !role || !isAssignableUserRole(role)) {
    return NextResponse.json(
      { error: "Missing or invalid fields: team, role." },
      { status: 400 },
    );
  }

  const username = session.user?.githubUsername;
  const platform = session.user?.platform;

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

  try {
    await resolveAdminMemberAccessRequest({
      requestId,
      decision: decision as "ACCEPT" | "DECLINE",
      reason,
      actor: {
        role: session.user.role,
        team: session.user.team ?? null,
        platform: session.user.platform ?? null,
        githubUsername: session.user.githubUsername,
      },
    });
  } catch (error) {
    if (error instanceof DbAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

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
