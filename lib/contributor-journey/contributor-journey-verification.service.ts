import { getUserById } from "@/db/users/users.db";
import { setDerivedJourneyStateByUid } from "@/db/user-journey-progress/user-journey-progress.db";
import {
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { requestGitHubRest } from "@/lib/github/github.rest";
import type {
  JourneyVerificationKind,
  JourneyVerificationResult,
} from "@/lib/domain/contributor-journey.types";
import {
  getContributorJourneySnapshotByUid,
  getContributorJourneyStoredProgressByUid,
} from "./contributor-journey.service";

type GitHubIssueResponse = {
  assignee: { login: string } | null;
  assignees: Array<{ login: string }>;
  html_url: string;
  number: number;
  pull_request?: object;
};

type GitHubIssueCommentResponse = {
  body: string | null;
  user: { login: string } | null;
};

type GitHubPullRequestResponse = {
  html_url: string;
  merged_at: string | null;
  number: number;
  user: { login: string } | null;
};

type ParsedGitHubArtifact = {
  issueNumber: number;
  normalizedUrl: string;
};

const CLAIM_COMMENT_PATTERN =
  /\b(claim|claimed|take(?!n)|taking|work(?:ing)? on|assign(?:ed)? to me)\b/i;

/**
 * Returns the expected GitHub repository for the selected contribution platform.
 *
 * @param platform The selected contribution platform.
 * @returns The expected GitHub owner and repo pair.
 */
function getExpectedRepo(platform: ContributionPlatform) {
  return GITHUB_REPOS[platform];
}

/**
 * Parses and validates a GitHub issue URL for the user's selected platform repo.
 *
 * @param url The user-submitted GitHub URL.
 * @param platform The selected contribution platform.
 * @param expectedPathSegment The expected artifact type path segment.
 * @returns The normalized GitHub artifact details.
 */
function parseGitHubArtifactUrl(
  url: string,
  platform: ContributionPlatform,
  expectedPathSegment: "issues" | "pull",
): ParsedGitHubArtifact {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new DbValidationError("url", "Verification URL must be a valid URL.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    (parsedUrl.hostname !== "github.com" &&
      parsedUrl.hostname !== "www.github.com")
  ) {
    throw new DbValidationError(
      "url",
      "Verification URL must be a GitHub HTTPS URL.",
    );
  }

  const expectedRepo = getExpectedRepo(platform);
  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  if (
    segments.length < 4 ||
    segments[0] !== expectedRepo.owner ||
    segments[1] !== expectedRepo.repo ||
    segments[2] !== expectedPathSegment
  ) {
    throw new DbValidationError(
      "url",
      `Verification URL must point to ${expectedRepo.owner}/${expectedRepo.repo} ${expectedPathSegment}.`,
    );
  }

  const issueNumber = Number.parseInt(segments[3], 10);

  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new DbValidationError(
      "url",
      "Verification URL must include a valid GitHub issue or pull request number.",
    );
  }

  return {
    issueNumber,
    normalizedUrl: `https://github.com/${expectedRepo.owner}/${expectedRepo.repo}/${expectedPathSegment}/${issueNumber}`,
  };
}

/**
 * Loads all issue comments for a GitHub issue.
 *
 * @param platform The selected contribution platform.
 * @param issueNumber The GitHub issue number to load comments for.
 * @returns All loaded GitHub issue comments.
 */
async function getAllIssueComments(
  platform: ContributionPlatform,
  issueNumber: number,
): Promise<GitHubIssueCommentResponse[]> {
  const { owner, repo } = getExpectedRepo(platform);
  const comments: GitHubIssueCommentResponse[] = [];
  let page = 1;

  while (true) {
    const batch = await requestGitHubRest<GitHubIssueCommentResponse[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    );

    comments.push(...batch);

    if (batch.length < 100) {
      return comments;
    }

    page += 1;
  }
}

/**
 * Verifies a first issue claim using assignee state or a claim-like comment by the user.
 *
 * @param platform The selected contribution platform.
 * @param githubUsername The contributor's GitHub username.
 * @param url The submitted issue URL.
 * @returns The verification result for the first issue claim milestone.
 */
async function verifyFirstIssueClaim(
  platform: ContributionPlatform,
  githubUsername: string,
  url: string,
): Promise<JourneyVerificationResult> {
  const { owner, repo } = getExpectedRepo(platform);
  const { issueNumber, normalizedUrl } = parseGitHubArtifactUrl(
    url,
    platform,
    "issues",
  );
  const issue = await requestGitHubRest<GitHubIssueResponse>(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
  );

  if (issue.pull_request) {
    throw new DbValidationError(
      "url",
      "Issue claim verification expects a GitHub issue URL, not a pull request URL.",
    );
  }

  const normalizedUsername = githubUsername.toLowerCase();
  const isAssignedToUser =
    issue.assignee?.login.toLowerCase() === normalizedUsername ||
    issue.assignees.some(
      (assignee) => assignee.login.toLowerCase() === normalizedUsername,
    );

  if (isAssignedToUser) {
    return {
      derivedKey: "FIRST_ISSUE_CLAIMED",
      message: `Issue #${issue.number} is assigned to @${githubUsername}.`,
      sourceUrl: normalizedUrl,
      verified: true,
    };
  }

  const comments = await getAllIssueComments(platform, issueNumber);
  const hasClaimComment = comments.some((comment) => {
    const author = comment.user?.login.toLowerCase();
    const body = comment.body ?? "";

    return author === normalizedUsername && CLAIM_COMMENT_PATTERN.test(body);
  });

  return {
    derivedKey: "FIRST_ISSUE_CLAIMED",
    message: hasClaimComment
      ? `Found a claim-style comment by @${githubUsername} on issue #${issue.number}.`
      : `Could not verify a claim for issue #${issue.number}. Use an assigned issue or a claim comment from @${githubUsername}.`,
    sourceUrl: normalizedUrl,
    verified: hasClaimComment,
  };
}

/**
 * Verifies that a GitHub pull request is merged and authored by the contributor.
 *
 * @param platform The selected contribution platform.
 * @param githubUsername The contributor's GitHub username.
 * @param url The submitted pull request URL.
 * @param derivedKey The derived milestone key being verified.
 * @returns The verification result for the merged pull request milestone.
 */
async function verifyMergedPullRequest(
  platform: ContributionPlatform,
  githubUsername: string,
  url: string,
  derivedKey: "FIRST_PR_MERGED" | "SECOND_PR_MERGED",
): Promise<JourneyVerificationResult> {
  const { owner, repo } = getExpectedRepo(platform);
  const { issueNumber, normalizedUrl } = parseGitHubArtifactUrl(
    url,
    platform,
    "pull",
  );
  const pr = await requestGitHubRest<GitHubPullRequestResponse>(
    `/repos/${owner}/${repo}/pulls/${issueNumber}`,
  );

  if (
    !pr.user?.login ||
    pr.user.login.toLowerCase() !== githubUsername.toLowerCase()
  ) {
    return {
      derivedKey,
      message: `PR #${pr.number} is not authored by @${githubUsername}.`,
      sourceUrl: normalizedUrl,
      verified: false,
    };
  }

  return {
    derivedKey,
    message: pr.merged_at
      ? `PR #${pr.number} was merged successfully.`
      : `PR #${pr.number} has not been merged yet.`,
    sourceUrl: normalizedUrl,
    verified: pr.merged_at !== null,
  };
}

/**
 * Verifies one contributor journey milestone and persists the derived progress state.
 *
 * @param uid The user id whose roadmap milestone is being verified.
 * @param platform The selected contribution platform.
 * @param kind The verification kind route being executed.
 * @param url The submitted GitHub URL to verify.
 * @returns The verification result plus the updated roadmap snapshot.
 */
export async function verifyContributorJourneyMilestoneByUid(
  uid: string,
  platform: ContributionPlatform,
  kind: JourneyVerificationKind,
  url: string,
): Promise<{
  result: JourneyVerificationResult;
  snapshot: Awaited<ReturnType<typeof getContributorJourneySnapshotByUid>>;
}> {
  const user = await getUserById(uid);

  if (!user) {
    throw new DbNotFoundError("User");
  }

  if (!user.githubUsername.trim()) {
    throw new DbInvalidStateError(
      "Contributor journey",
      "GitHub username is required before roadmap verification can run.",
    );
  }

  const progress = await getContributorJourneyStoredProgressByUid(
    uid,
    platform,
  );
  let result: JourneyVerificationResult;

  if (kind === "first-issue-claim") {
    if (progress.derivedState.FIRST_ISSUE_CLAIMED.completed) {
      result = {
        derivedKey: "FIRST_ISSUE_CLAIMED",
        message: "Your first issue claim has already been verified.",
        sourceUrl: progress.derivedState.FIRST_ISSUE_CLAIMED.sourceUrl ?? url,
        verified: true,
      };
    } else {
      result = await verifyFirstIssueClaim(platform, user.githubUsername, url);
    }
  } else if (kind === "first-pr-merge") {
    if (progress.derivedState.FIRST_PR_MERGED.completed) {
      result = {
        derivedKey: "FIRST_PR_MERGED",
        message: "Your first merged PR has already been verified.",
        sourceUrl: progress.derivedState.FIRST_PR_MERGED.sourceUrl ?? url,
        verified: true,
      };
    } else {
      result = await verifyMergedPullRequest(
        platform,
        user.githubUsername,
        url,
        "FIRST_PR_MERGED",
      );
    }
  } else {
    if (progress.derivedState.SECOND_PR_MERGED.completed) {
      result = {
        derivedKey: "SECOND_PR_MERGED",
        message: "Your second merged PR has already been verified.",
        sourceUrl: progress.derivedState.SECOND_PR_MERGED.sourceUrl ?? url,
        verified: true,
      };
    } else {
      result = await verifyMergedPullRequest(
        platform,
        user.githubUsername,
        url,
        "SECOND_PR_MERGED",
      );

      const firstPrSourceUrl = progress.derivedState.FIRST_PR_MERGED.sourceUrl;

      if (
        result.verified &&
        firstPrSourceUrl &&
        firstPrSourceUrl === result.sourceUrl
      ) {
        result = {
          ...result,
          message:
            "Second PR verification requires a different pull request from the first merged PR milestone.",
          verified: false,
        };
      }
    }
  }

  if (!progress.derivedState[result.derivedKey].completed) {
    await setDerivedJourneyStateByUid(uid, result.derivedKey, {
      completed: result.verified,
      completedAt: result.verified ? new Date() : null,
      sourceUrl: result.sourceUrl,
    });
  }

  return {
    result,
    snapshot: await getContributorJourneySnapshotByUid(uid, platform),
  };
}
