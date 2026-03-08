import { NextResponse } from "next/server";
import {
  getAllUsers,
  updateUserRoleTeamAndNotifyByUid,
} from "@/db/users.db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { isValidUserRole } from "@/lib/utils/roles.utils";


export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await getAllUsers();
  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const uid =
    typeof body.uid === "string" ? body.uid.trim() : "";
  const role =
    typeof body.role === "string" ? body.role.trim() : "";
  const team =
    typeof body.team === "string" ? body.team.trim() : null;
  const githubUsername =
    typeof body.githubUsername === "string"
      ? body.githubUsername.trim()
      : null;
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";

  if (!uid || !role || !isValidUserRole(role) || !reason) {
    return NextResponse.json(
      { error: "Invalid payload for user update." },
      { status: 400 }
    );
  }

  await updateUserRoleTeamAndNotifyByUid(
    uid,
    role,
    team,
    reason,
    githubUsername,
    session.user.email ?? undefined
  );

  return NextResponse.json({ success: true });
}
