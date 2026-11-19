import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { UserRole } from "@/lib/auth/auth.types";
import {
  DbAuthorizationError,
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/lib/errors";
import {
  listPendingTeamMemberAccessRequests,
  resolveTeamMemberAccessRequest,
} from "@/lib/member-access-requests/member-access-requests.service";

function canManageTeamRequests(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageTeamRequests(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!session.user.team || !session.user.platform) {
    return NextResponse.json(
      { error: "Your team assignment is incomplete." },
      { status: 400 },
    );
  }

  const requests = await listPendingTeamMemberAccessRequests(
    session.user.platform,
    session.user.team,
  );

  return NextResponse.json({
    pending: requests,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageTeamRequests(session.user.role)) {
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

  const { team, platform, githubUsername } = session.user;

  if (!team || !platform) {
    return NextResponse.json(
      { error: "Your team assignment is incomplete." },
      { status: 400 },
    );
  }

  try {
    await resolveTeamMemberAccessRequest({
      requestId,
      decision: decision as "ACCEPT" | "DECLINE",
      reason,
      actor: {
        role: session.user.role,
        team: session.user.team ?? null,
        platform: session.user.platform ?? null,
        githubUsername,
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
