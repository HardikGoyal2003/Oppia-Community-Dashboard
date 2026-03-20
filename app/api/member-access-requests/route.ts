import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getMemberAccessRequests,
  resolveMemberAccessRequest,
  submitMemberAccessRequest,
} from "@/db/member-request-access/member-request-access.db";
import {
  appendUserNotificationByEmail,
  getUserByEmail,
  updateUserRoleTeamAndNotifyByEmail,
} from "@/db/users.db";
import { UserRole } from "@/lib/auth/auth.types";
import { isValidUserRole } from "@/lib/utils/roles.utils";


function getPromotionMessage(role: UserRole, team: string): string {
  const roleLabel = role.replace("_", " ");

  switch (role) {
    case "TEAM_MEMBER":
      return `Great news! You are now a ${roleLabel} on ${team}. We're really happy to have you onboard.`;
    case "TEAM_LEAD":
      return `Amazing! You have been promoted to ${roleLabel} on ${team}. We're truly excited to have you leading with us onboard.`;
    case "ADMIN":
      return `Outstanding! You have been promoted to ${roleLabel} on ${team}. We're incredibly grateful and thrilled to have you onboard in this key role.`;
    default:
      return `Welcome! Your access request has been approved and your role is now ${roleLabel} on ${team}. We're happy to have you onboard.`;
  }
}

function getDeclineMessage(reason: string): string {
  return [
    "Thank you for your request. At this moment, we are unable to approve it.",
    `Reason: ${reason}`,
    "Please refine your request and apply again. We appreciate your interest in contributing with us.",
  ].join("\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const requests = await getMemberAccessRequests();
  return NextResponse.json({ pending: requests.pending });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const team =
    typeof body.team === "string" ? body.team.trim() : "";
  const role =
    typeof body.role === "string" ? body.role.trim() : "";
  const note =
    typeof body.note === "string" ? body.note.trim() : "";

  if (!team || !role || !isValidUserRole(role)) {
    return NextResponse.json(
      { error: "Missing or invalid fields: team, role." },
      { status: 400 }
    );
  }

  const dbUser = await getUserByEmail(session.user.email);
  const username = dbUser?.githubUsername?.trim() ?? "";

  if (!username) {
    return NextResponse.json(
      {
        error:
          "No GitHub username was found on your account. Please sign out and sign in again.",
      },
      { status: 400 }
    );
  }

  await submitMemberAccessRequest({
    email: session.user.email,
    team,
    role,
    note,
    username,
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const email = body.email.trim();
  const decision = body.decision.trim();
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";

  if (!email || !decision || !["ACCEPT", "DECLINE"].includes(decision)) {
    return NextResponse.json(
      { error: "Invalid email/decision payload." },
      { status: 400 }
    );
  }

  if (decision === "DECLINE" && !reason) {
    return NextResponse.json(
      { error: "Decline reason is required." },
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

    await updateUserRoleTeamAndNotifyByEmail(
      request.email,
      request.role,
      request.team,
      request.username,
      getPromotionMessage(request.role, request.team)
    );
  } else {
    await appendUserNotificationByEmail(
      request.email,
      getDeclineMessage(reason)
    );
  }

  return NextResponse.json({ success: true });
}
