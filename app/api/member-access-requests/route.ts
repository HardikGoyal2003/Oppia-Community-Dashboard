import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getMemberAccessRequests,
  resolveMemberAccessRequest,
} from "@/db/member-request-access/member-request-access.db";
import { MemberAccessDecision } from "@/db/member-request-access/member-request-access.types";
import {
  appendUserNotificationByEmail,
  updateUserRoleTeamAndNotifyByEmail,
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
    "Thank you for your request.",
    "At this moment, we are unable to approve it.",
    `Reason: ${reason}`,
    "Please refine your request and apply again. We appreciate your interest in contributing with us.",
  ].join(" ");
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
