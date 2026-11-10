import {
  extractCycleRecordsForPR,
  fetchClosedPRsForCycleWindow,
  fetchOpenPRsForCycleWindow,
  type CycleRecord,
  type GitHubPullResponse,
} from "@/lib/github/github.fetcher";

export type ReviewCycleBackfillStepInput = {
  /** Inclusive start of the window. */
  sinceDate: Date;
  /** Inclusive end of the window. */
  untilDate: Date;
  /** PR numbers already processed inside this window. */
  processedPrNumbers: Set<number>;
  /** Reviewer logins that should be persisted. */
  knownLogins: Set<string>;
  /** Absolute epoch ms after which no new PR is started. */
  deadlineMs: number;
};

export type ReviewCycleBackfillStepResult = {
  /** Cycles extracted during this step, filtered to known reviewers. */
  records: CycleRecord[];
  /** PR numbers processed during this step. */
  processedPrNumbers: number[];
  /** Whether every PR in the window has now been processed. */
  complete: boolean;
  /** Authors of the PRs scanned in this window. */
  authorLogins: Set<string>;
};

/**
 * Processes one date window of the review-cycle backfill.
 *
 * Lists the open and closed PRs in the window, skips PRs already checkpointed,
 * and extracts cycles until the deadline is reached. The caller persists the
 * returned records and PR numbers, so a run that stops early resumes without
 * re-fetching the same PRs.
 *
 * @param input The window, checkpoint, and deadline to process.
 * @returns The extracted cycles, processed PR numbers, and completion flag.
 */
export async function runReviewCycleBackfillStep(
  input: ReviewCycleBackfillStepInput,
): Promise<ReviewCycleBackfillStepResult> {
  const [openPrs, closedPrs] = await Promise.all([
    fetchOpenPRsForCycleWindow(input.sinceDate, input.untilDate),
    fetchClosedPRsForCycleWindow(input.sinceDate, input.untilDate),
  ]);

  const prsByNumber = new Map<number, GitHubPullResponse>();
  for (const pr of [...openPrs, ...closedPrs]) {
    if (!prsByNumber.has(pr.number)) {
      prsByNumber.set(pr.number, pr);
    }
  }

  const remainingPrs = Array.from(prsByNumber.values()).filter(
    (pr) => !input.processedPrNumbers.has(pr.number),
  );

  const authorLogins = new Set<string>();
  for (const pr of prsByNumber.values()) {
    const author = pr.user?.login;
    if (author) authorLogins.add(author);
  }

  const records: CycleRecord[] = [];
  const processedPrNumbers: number[] = [];
  let complete = true;

  for (const pr of remainingPrs) {
    if (Date.now() >= input.deadlineMs) {
      complete = false;
      break;
    }

    console.log(`  Backfilling PR #${pr.number}...`);

    const result = await extractCycleRecordsForPR(pr, false);
    records.push(
      ...result.completed.filter((cycle) =>
        input.knownLogins.has(cycle.reviewerLogin),
      ),
    );
    processedPrNumbers.push(pr.number);
  }

  return { records, processedPrNumbers, complete, authorLogins };
}
