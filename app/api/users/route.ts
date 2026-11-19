import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import {
  DbAuthorizationError,
  DbNotFoundError,
  DbValidationError,
} from "@/lib/errors";
import {
  getManagedUsers,
  updateManagedUserAccess,
} from "@/lib/users/users.service";

function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
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

  const users = await getManagedUsers(platform);
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

  if (!uid || !role || !githubUsername || !reason) {
    return NextResponse.json(
      { error: "Invalid payload for user update." },
      { status: 400 },
    );
  }

  try {
    await updateManagedUserAccess({
      uid,
      role: role as UserRole,
      team,
      githubUsername,
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
