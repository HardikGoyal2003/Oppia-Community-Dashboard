import { NextResponse } from "next/server";
import {
  getUsersByPlatform,
  type UserRecord,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getKnownRoleDisplayLabel } from "@/lib/auth/role-display";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isValidUserRole } from "@/lib/utils/roles.utils";
import { DbNotFoundError, DbValidationError } from "@/db/db.errors";

type ManagedUser = Pick<
  UserRecord,
  "id" | "fullName" | "email" | "githubUsername" | "platform" | "role" | "team"
>;

function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Selects only the user fields required by the user-role manager UI.
 *
 * @param user The full user record.
 * @returns The minimal user payload exposed to the client.
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

  const users = await getUsersByPlatform(platform);
  return NextResponse.json(users.map(toManagedUser));
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
