"use server";

import { main } from "@/lib/github/scripts/github-issues.fetcher";
import { formatIssues } from "@/lib/github/service/ format-issues.service";
import { RawIssue, RawIssueNode } from "@/lib/github/github-fetcher.types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getMemberAccessRequests,
  respondToMemberAccessRequest,
  submitMemberAccessRequest,
} from "@/lib/db/member-request-access.service";
import {
  MemberAccessDecision,
  MemberAccessRequestModel,
} from "@/lib/db/member-request-access.types";
import {
  updateUserRoleAndTeamByEmail,
} from "@/lib/db/users.service";
import { UserRole } from "@/lib/auth/auth.types";

function isValidUserRole(role: string): role is UserRole {
  return [
    "CONTRIBUTOR",
    "TEAM_MEMBER",
    "TEAM_LEAD",
    "ADMIN",
  ].includes(role);
}

export async function fetchGithubIssues(): Promise<{ issues: RawIssue[] }> {
  try {
    const issuesData: RawIssueNode[] = await main();
    return { issues: formatIssues(issuesData) };
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch GitHub issues");
  }
}

export async function submitMemberAccessRequestAction(input: {
  team: string;
  role: string;
  note: string;
  username: string;
}): Promise<{ success: true }> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    throw new Error("Unauthorized");
  }

  const team = input.team.trim();
  const role = input.role.trim();
  const username = input.username.trim();
  const note = input.note.trim();

  if (!team || !role || !username) {
    throw new Error("Missing required fields: team, role, username.");
  }

  if (!isValidUserRole(role)) {
    throw new Error("Invalid role.");
  }

  await submitMemberAccessRequest({
    email: session.user.email,
    team,
    role,
    note,
    username,
  });

  return { success: true };
}

export async function getPendingMemberAccessRequestsAction(): Promise<
  MemberAccessRequestModel[]
> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const requests = await getMemberAccessRequests();
  return requests.pending;
}

export async function resolveMemberAccessRequestAction(input: {
  email: string;
  decision: MemberAccessDecision;
}): Promise<{ success: true }> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const request = await respondToMemberAccessRequest(
    input.email,
    input.decision
  );

  if (input.decision === "ACCEPT") {
    if (!isValidUserRole(request.role)) {
      throw new Error("Invalid role in access request.");
    }

    await updateUserRoleAndTeamByEmail(
      request.email,
      request.role,
      request.team || null
    );
  }

  return { success: true };
}
