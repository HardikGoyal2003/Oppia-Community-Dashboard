/**
 * Normalizes a GitHub username for case-insensitive comparisons across systems.
 *
 * GitHub logins are stored verbatim in Firestore, while external member sheets
 * can use different casing, so every cross-source lookup must compare
 * normalized values only.
 *
 * @param username The GitHub username to normalize.
 * @returns The trimmed, lowercased username.
 */
export function normalizeGithubUsername(username: string): string {
  return username.trim().toLowerCase();
}
