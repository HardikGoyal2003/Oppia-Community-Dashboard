import { NextResponse } from "next/server";
import {
  getUsersByPlatform,
  updateUserRoleAndTeamWithNotificationByUid,
} from "@/db/users/users.db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import { isValidUserRole } from "@/lib/utils/roles.utils";

function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function getUserAccessUpdatedMessage(
  role: UserRole,
  team: string | null,
  reason: string,
  changedByEmail?: string,
): string {
  const roleLabel = role.replace("_", " ");
  const teamLabel = team ?? "Unassigned";
  const actor = changedByEmail ?? "Admin";

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
  return NextResponse.json(users);
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

  await updateUserRoleAndTeamWithNotificationByUid(
    uid,
    role,
    team,
    githubUsername,
    getUserAccessUpdatedMessage(
      role,
      team,
      reason,
      session.user.email ?? undefined,
    ),
  );

  return NextResponse.json({ success: true });
}
