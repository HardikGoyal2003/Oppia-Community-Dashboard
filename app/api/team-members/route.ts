import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import { UserRole } from "@/lib/auth/auth.types";
import { TEAM_LEAD_ASSIGNABLE_ROLES } from "@/lib/auth/roles";
import { isValidUserRole } from "@/lib/utils/roles.utils";
import {
  getUsersByTeam,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";
import { DbNotFoundError, DbValidationError } from "@/db/db.errors";

function canManageTeamMembers(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

function isAllowedRole(role: UserRole): boolean {
  return TEAM_LEAD_ASSIGNABLE_ROLES.includes(role);
}

function getUserAccessUpdatedMessage(
  role: UserRole,
  team: string | null,
  reason: string,
  changedByGithubUsername?: string,
): string {
  const roleLabel = getKnownRoleDisplayLabel(role);
  const teamLabel = team ?? "Unassigned";
  const actor = changedByGithubUsername ?? "Team Lead";

  return [
    `Your access details were updated by ${actor}.`,
    `New role: ${roleLabel}`,
    `New team: ${teamLabel}`,
    `Reason: ${reason}`,
  ].join("\n");
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

  const allMembers = await getUsersByTeam(session.user.team);
  const members = allMembers.filter((m) => m.role !== "ALUMNI");
  return NextResponse.json(members);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageTeamMembers(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const team = typeof body.team === "string" ? body.team.trim() : null;
  const githubUsername =
    typeof body.githubUsername === "string" ? body.githubUsername.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!uid || !role || !isValidUserRole(role) || !githubUsername || !reason) {
    return NextResponse.json(
      { error: "Invalid payload for user update." },
      { status: 400 },
    );
  }

  if (!isAllowedRole(role as UserRole)) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to assign this role.",
      },
      { status: 403 },
    );
  }

  if (team && team !== session.user.team) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to assign users to another team.",
      },
      { status: 403 },
    );
  }

  try {
    await updateUserRoleAndTeamWithNotificationByUid(
      uid,
      role as UserRole,
      team,
      githubUsername,
      getUserAccessUpdatedMessage(
        role as UserRole,
        team,
        reason,
        session.user?.githubUsername,
      ),
    );
  } catch (error) {
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
