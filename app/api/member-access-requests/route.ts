import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getMemberAccessRequests,
  resolveMemberAccessRequest,
} from "@/db/member-request-access/member-request-access.db";
import { MemberAccessDecision } from "@/db/member-request-access/member-request-access.types";
import {
  updateUserRoleAndTeamByEmail,
} from "@/db/users.db";
import { UserRole } from "@/lib/auth/auth.types";

function isValidUserRole(role: string): role is UserRole {
  return [
    "CONTRIBUTOR",
    "TEAM_MEMBER",
    "TEAM_LEAD",
    "ADMIN",
  ].includes(role);
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const requests = await getMemberAccessRequests();
  return NextResponse.json({ pending: requests.pending });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const email =
    typeof body.email === "string" ? body.email.trim() : "";
  const decision =
    typeof body.decision === "string"
      ? (body.decision.trim() as MemberAccessDecision)
      : null;

  if (!email || !decision || !["ACCEPT", "DECLINE"].includes(decision)) {
    return NextResponse.json(
      { error: "Invalid email/decision payload." },
      { status: 400 }
    );
  }

  const request = await resolveMemberAccessRequest(email, decision);

  if (decision === "ACCEPT") {
    if (!isValidUserRole(request.role)) {
      return NextResponse.json(
        { error: "Invalid role in request." },
        { status: 400 }
      );
    }

    await updateUserRoleAndTeamByEmail(
      request.email,
      request.role,
      request.team
    );
  }

  return NextResponse.json({ success: true });
}
