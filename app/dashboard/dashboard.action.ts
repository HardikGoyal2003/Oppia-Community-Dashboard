"use server";

import { main } from "@/lib/github/scripts/github-issues.fetcher";
import { formatIssues } from "@/lib/github/service/ format-issues.service";
import { RawIssue, RawIssueNode } from "@/lib/github/github-fetcher.types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { submitMemberAccessRequest } from "@/lib/db/member-request-access.service";

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

  await submitMemberAccessRequest({
    email: session.user.email,
    team,
    role,
    note,
    username,
  });

  return { success: true };
}
