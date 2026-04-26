import { NextResponse } from "next/server";
import {
  getUsersByPlatform,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isUserRole } from "@/lib/auth/roles";
import { isValidUserRole } from "@/lib/utils/roles.utils";
import { DbNotFoundError, DbValidationError } from "@/db/db.errors";

function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function getUserAccessUpdatedMessage(
  role: UserRole,
  team: string | null,
  reason: string,
  changedByGithubUsername?: string,
): string {
  const roleLabel = getKnownRoleDisplayLabel(role);
  const teamLabel = team ?? "Unassigned";
  const actor = changedByGithubUsername ?? "Admin";

  return [
    `Your access details were updated by ${actor}.`,
    `New role: ${roleLabel}`,
    `New team: ${teamLabel}`,
    `Reason: ${reason}`,
  ].join("\n");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const platformParam = searchParams.get("platform");
  const platform =
    platformParam === "WEB" || platformParam === "ANDROID"
      ? (platformParam as ContributionPlatform)
      : undefined;
  const cursorParam = searchParams.get("cursor");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? limitParam : undefined;
  const roleParam = searchParams.get("role");
  const teamParam = searchParams.get("team");
  const nameParam = searchParams.get("name");
  const filters = {
    role:
      roleParam && isUserRole(roleParam) ? (roleParam as UserRole) : undefined,
    team: teamParam?.trim() || undefined,
    name: nameParam?.trim() || undefined,
  };

  if (roleParam && !filters.role) {
    return NextResponse.json(
      { error: "Invalid role filter." },
      { status: 400 },
    );
  }

  try {
    const usersPage = await getUsersByPlatform(
      platform,
      filters,
      cursorParam,
      limit,
    );
    return NextResponse.json(usersPage);
  } catch (error) {
    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageUsers(session.user.role)) {
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

  try {
    await updateUserRoleAndTeamWithNotificationByUid(
      uid,
      role,
      team,
      githubUsername,
      getUserAccessUpdatedMessage(
        role,
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
