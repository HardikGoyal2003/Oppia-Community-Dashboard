import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { UserRole } from "@/lib/auth/auth.types";
import {
  DbAuthorizationError,
  DbNotFoundError,
  DbValidationError,
} from "@/lib/errors";
import {
  getTeamMembers,
  updateTeamMemberAccess,
} from "@/lib/users/users.service";

function canManageTeamMembers(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageTeamMembers(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!session.user.team) {
    return NextResponse.json(
      { error: "You are not assigned to any team." },
      { status: 400 },
    );
  }

  const members = await getTeamMembers(session.user.team);
  return NextResponse.json(members);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageTeamMembers(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { team: callerTeam } = session.user;

  if (!callerTeam) {
    return NextResponse.json(
      { error: "You are not assigned to any team." },
      { status: 400 },
    );
  }

  const body = await req.json();
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const requestedTeam = typeof body.team === "string" ? body.team.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!uid || !role || !reason) {
    return NextResponse.json(
      { error: "Invalid payload for user update." },
      { status: 400 },
    );
  }

  if (requestedTeam && requestedTeam !== callerTeam) {
    return NextResponse.json(
      {
        error: "You do not have permission to assign users to another team.",
      },
      { status: 403 },
    );
  }

  try {
    await updateTeamMemberAccess({
      uid,
      role: role as UserRole,
      team: callerTeam,
      reason,
      actor: {
        role: session.user.role,
        team: session.user.team ?? null,
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

    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  return NextResponse.json({ success: true });
}
