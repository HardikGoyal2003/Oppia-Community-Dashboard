import type { MyReviewerReport } from "@/lib/domain/reviewer-teams.types";

type MyReviewerReportsResponse = {
  report: MyReviewerReport | null;
};

/**
 * Fetches the reviewer report belonging to the signed-in GitHub user.
 *
 * The API derives the login from the session, so no identity is sent by the
 * client. A null report means the login is not part of the synced reviewer data.
 *
 * @returns The caller's reviewer report, or null when none exists.
 */
export async function fetchMyReviewerReport(): Promise<MyReviewerReport | null> {
  const response = await fetch("/api/reviewer-teams/me", {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load your reviewer report.");
  }

  const data = (await response.json()) as MyReviewerReportsResponse;
  return data.report;
}
