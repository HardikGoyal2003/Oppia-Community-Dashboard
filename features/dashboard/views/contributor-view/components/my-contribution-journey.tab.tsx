"use client";

import { useEffect, useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Lock,
  ListTodo,
  ShieldCheck,
} from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  CONTRIBUTOR_JOURNEY_CONTENT,
  type ContributorJourneyChecklistItem,
  type ContributorJourneyRichNote,
} from "@/lib/config";
import { cn } from "@/lib/utils/classnames.utils";
import MyContributionJourneyBeforeYouStart from "./my-contribution-journey-before-you-start";
import JourneyManualCompletionDialog from "./journey-manual-completion-dialog";
import JourneyVerificationCard from "./journey-verification-card";
import JourneyVerificationDialog from "./journey-verification-dialog";
import MyContributionJourneyIssueFinder, {
  type GfiDomain,
} from "./my-contribution-journey-issue-finder";
import MyContributionJourneyProgressHero from "./my-contribution-journey-progress-hero";

type ContributorJourneyItemSnapshot = ContributorJourneyChecklistItem & {
  completed: boolean;
  completedAt: string | null;
  locked: boolean;
};

type ContributorJourneyTaskSnapshot = {
  id: string;
  items: ContributorJourneyItemSnapshot[];
  title: string;
};

type ContributorJourneyResponse = {
  progress: {
    completedManualCount: number;
    completedRequiredCount: number;
    totalManualCount: number;
    totalRequiredCount: number;
  };
  tasks: ContributorJourneyTaskSnapshot[];
};

type ApiErrorResponse = {
  error?: string;
};

function getInitialGfiDomain(platform: ContributionPlatform): GfiDomain {
  if (platform === "ANDROID") {
    return "LEARNER_FACING";
  }

  return "FRONTEND";
}

function sanitizeGithubUrl(url: string): string | null {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const isGithubHost =
      parsedUrl.hostname === "github.com" ||
      parsedUrl.hostname === "www.github.com";

    if (!isHttps || !isGithubHost) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function getApiErrorMessage(
  body: ContributorJourneyResponse | ApiErrorResponse | null,
  fallbackMessage: string,
): string {
  if (
    body &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim()
  ) {
    return body.error;
  }

  return fallbackMessage;
}

function getImportanceCheckboxClassName(
  importance: ContributorJourneyChecklistItem["importance"],
): string {
  if (importance === "high") {
    return "border-red-500 peer-checked:border-red-700 peer-checked:bg-red-700";
  }

  if (importance === "medium") {
    return "border-yellow-500 peer-checked:border-yellow-500 peer-checked:bg-yellow-500";
  }

  return "border-blue-500 peer-checked:border-blue-700 peer-checked:bg-blue-700";
}

function getImportanceLabel(
  importance: ContributorJourneyChecklistItem["importance"],
): string {
  if (importance === "high") {
    return "Required to move on";
  }

  if (importance === "medium") {
    return "Strongly recommended";
  }

  return "Optional";
}

function isRequiredChecklistItem(
  item: ContributorJourneyChecklistItem,
): boolean {
  return item.importance === "high";
}

function isRichNote(
  note: string | ContributorJourneyRichNote,
): note is ContributorJourneyRichNote {
  return typeof note !== "string";
}

function renderRichNote(note: ContributorJourneyRichNote) {
  return (
    <>
      {note.prefix && <span> {note.prefix} </span>}
      <a
        href={note.href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-blue-700 hover:underline"
      >
        {note.hrefLabel}
      </a>
      {note.suffix && <span> {note.suffix}</span>}
    </>
  );
}

function isRecommendedChecklistItem(
  item: ContributorJourneyChecklistItem,
): boolean {
  return item.importance === "medium";
}

function isVerificationItem(item: ContributorJourneyChecklistItem): boolean {
  return item.completionType === "verification";
}

function isFirstPrMergeItem(item: ContributorJourneyChecklistItem): boolean {
  return item.completionType === "verification" && item.id === "merge_first_pr";
}

function isSecondPrMergeItem(item: ContributorJourneyChecklistItem): boolean {
  return (
    item.completionType === "verification" && item.id === "merge_second_pr"
  );
}

function isFirstIssueClaimItem(item: ContributorJourneyChecklistItem): boolean {
  return (
    item.completionType === "verification" && item.id === "claim_first_issue"
  );
}

export default function MyContributionJourneyTab({
  platform,
}: {
  platform: ContributionPlatform;
}) {
  const [journeyData, setJourneyData] =
    useState<ContributorJourneyResponse | null>(null);
  const [isLoadingJourney, setIsLoadingJourney] = useState(true);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);
  const [pendingCompletionItem, setPendingCompletionItem] = useState<{
    itemId: string;
    label: string;
  } | null>(null);
  const [firstIssueLink, setFirstIssueLink] = useState("");
  const [firstPrLink, setFirstPrLink] = useState("");
  const [secondPrLink, setSecondPrLink] = useState("");
  const [activeVerificationDialog, setActiveVerificationDialog] = useState<
    "first_issue_claim" | "first_pr_merge" | "second_pr_merge" | null
  >(null);
  const [selectedGfiDomain, setSelectedGfiDomain] = useState<GfiDomain>(() =>
    getInitialGfiDomain(platform),
  );
  const sanitizedFirstIssueLink = sanitizeGithubUrl(firstIssueLink);
  const sanitizedFirstPrLink = sanitizeGithubUrl(firstPrLink);
  const sanitizedSecondPrLink = sanitizeGithubUrl(secondPrLink);
  const journeyContent = CONTRIBUTOR_JOURNEY_CONTENT[platform];
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<string[]>([
    journeyContent.tasks[0]?.id ?? "",
  ]);
  const tasks = journeyData?.tasks ?? [];
  const allChecklistItems = tasks.flatMap((task) =>
    task.items.filter((item) => !isVerificationItem(item)),
  );
  const requiredChecklistItems = tasks.flatMap((task) =>
    task.items.filter(
      (item) => isRequiredChecklistItem(item) && !isVerificationItem(item),
    ),
  );
  const completedRequiredCount =
    journeyData?.progress.completedRequiredCount ?? 0;
  const phasesWithState = tasks.map((task, taskIndex) => {
    const isLocked =
      taskIndex > 0 &&
      tasks
        .slice(0, taskIndex)
        .flatMap((previousTask) =>
          previousTask.items.filter(
            (item) =>
              isRequiredChecklistItem(item) && !isVerificationItem(item),
          ),
        )
        .some((item) => !item.completed);
    const completedItemsInTask = task.items.filter(
      (item) => !isVerificationItem(item) && item.completed,
    ).length;
    const trackableItemsInTask = task.items.filter(
      (item) => !isVerificationItem(item),
    ).length;

    return {
      completedItemsInTask,
      isLocked,
      task,
      trackableItemsInTask,
    };
  });
  const phaseCheckpoints = tasks.map((task, taskIndex) => {
    const requiredItemsBeforePhase = tasks
      .slice(0, taskIndex + 1)
      .flatMap((currentTask) =>
        currentTask.items.filter(
          (item) => isRequiredChecklistItem(item) && !isVerificationItem(item),
        ),
      ).length;
    const highItems = task.items.filter(
      (item) => isRequiredChecklistItem(item) && !isVerificationItem(item),
    );
    const mediumItems = task.items.filter(
      (item) => isRecommendedChecklistItem(item) && !isVerificationItem(item),
    );
    const allHighDone = highItems.every((item) => item.completed);
    const allMediumDone = mediumItems.every((item) => item.completed);
    const status: "complete" | "in_progress" | "recommended_left" = allHighDone
      ? allMediumDone
        ? "complete"
        : "recommended_left"
      : "in_progress";

    return {
      id: task.id,
      leftPercentage:
        requiredChecklistItems.length === 0
          ? 0
          : (requiredItemsBeforePhase / requiredChecklistItems.length) * 100,
      status,
      title: task.title,
    };
  });

  useEffect(() => {
    let isMounted = true;

    async function loadJourney() {
      if (isMounted) {
        setIsLoadingJourney(true);
        setJourneyError(null);
      }

      try {
        const response = await fetch("/api/contributor-journey", {
          cache: "no-store",
        });

        const body = (await response.json().catch(() => null)) as
          | ContributorJourneyResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(body, "Failed to load contributor journey."),
          );
        }

        if (isMounted) {
          setJourneyData(body as ContributorJourneyResponse);
        }
      } catch (error) {
        if (isMounted) {
          setJourneyError(
            error instanceof Error
              ? error.message
              : "Failed to load contributor journey.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingJourney(false);
        }
      }
    }

    loadJourney();

    return () => {
      isMounted = false;
    };
  }, [platform]);

  function requestManualCompletion(itemId: string, label: string) {
    setPendingCompletionItem({ itemId, label });
  }

  async function confirmManualCompletion() {
    if (!pendingCompletionItem) {
      return;
    }

    setIsSavingCompletion(true);
    setJourneyError(null);

    try {
      const response = await fetch("/api/contributor-journey", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: pendingCompletionItem.itemId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | ContributorJourneyResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            body,
            "Failed to save contributor journey progress.",
          ),
        );
      }

      setJourneyData(body as ContributorJourneyResponse);
      setPendingCompletionItem(null);
    } catch (error) {
      setJourneyError(
        error instanceof Error
          ? error.message
          : "Failed to save contributor journey progress.",
      );
    } finally {
      setIsSavingCompletion(false);
    }
  }

  function toggleExpandedPhase(taskId: string) {
    setExpandedPhaseIds((currentPhaseIds) =>
      currentPhaseIds.includes(taskId)
        ? currentPhaseIds.filter((currentPhaseId) => currentPhaseId !== taskId)
        : currentPhaseIds.concat(taskId),
    );
  }

  function openFirstPrDialog() {
    setActiveVerificationDialog("first_pr_merge");
  }

  function openFirstIssueDialog() {
    setActiveVerificationDialog("first_issue_claim");
  }

  function openSecondPrDialog() {
    setActiveVerificationDialog("second_pr_merge");
  }

  const completedCount = journeyData?.progress.completedManualCount ?? 0;
  const isJourneyCompleted =
    allChecklistItems.length > 0 && completedCount === allChecklistItems.length;
  const progressPercentage = Math.round(
    requiredChecklistItems.length === 0
      ? 0
      : (completedRequiredCount / requiredChecklistItems.length) * 100,
  );
  const activePhase =
    phasesWithState.find(
      ({ isLocked, task }) =>
        !isLocked &&
        task.items
          .filter(
            (item) =>
              isRequiredChecklistItem(item) && !isVerificationItem(item),
          )
          .some((item) => !item.completed),
    )?.task ??
    phasesWithState.findLast(({ isLocked }) => !isLocked)?.task ??
    tasks[0] ??
    journeyContent.tasks[0];

  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f4f6fb_55%,#eef2f7_100%)] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 shadow-sm">
              <ListTodo className="h-3.5 w-3.5" />
              Contributor Onboarding
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Welcome to Oppia Community Dashboard 👋
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                {journeyContent.intro}
              </p>
            </div>
          </div>

          <MyContributionJourneyProgressHero
            activePhaseTitle={activePhase.title}
            completedCount={completedCount}
            completedRequiredCount={completedRequiredCount}
            phaseCheckpoints={phaseCheckpoints}
            phaseCount={journeyContent.tasks.length}
            progressPercentage={progressPercentage}
            requiredChecklistItemCount={requiredChecklistItems.length}
            totalChecklistItemCount={allChecklistItems.length}
          />

          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_70px_-48px_rgba(15,23,42,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-5">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-950">
                  My Contribution Journey
                </h2>
                <p className="text-sm text-slate-600">
                  Finish these setup tasks before you start sending
                  contributions.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 shadow-sm">
                {completedCount} done
              </div>
            </div>

            <MyContributionJourneyBeforeYouStart />

            {isLoadingJourney && (
              <div className="border-b border-slate-100 px-6 py-4 text-sm text-slate-600">
                Loading your contributor journey...
              </div>
            )}

            {journeyError && (
              <div className="border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
                {journeyError}
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {!isLoadingJourney &&
                phasesWithState.map(
                  ({
                    task,
                    isLocked,
                    completedItemsInTask,
                    trackableItemsInTask,
                  }) => {
                    return (
                      <div key={task.id}>
                        <button
                          type="button"
                          disabled={isLocked}
                          className={cn(
                            "flex w-full items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-4 text-left transition-colors",
                            isLocked
                              ? "cursor-not-allowed opacity-70"
                              : "hover:bg-slate-100/90",
                          )}
                          onClick={() => {
                            if (!isLocked) {
                              toggleExpandedPhase(task.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {isLocked ? (
                              <Lock className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-slate-500 transition-transform",
                                  expandedPhaseIds.includes(task.id) &&
                                    "rotate-180",
                                )}
                              />
                            )}
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {task.title}
                              </h3>
                              {isLocked && (
                                <p className="text-xs text-slate-500">
                                  Complete all required items in earlier phases
                                  to unlock this phase.
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                            {completedItemsInTask}/{trackableItemsInTask}
                          </span>
                        </button>

                        {!isLocked && expandedPhaseIds.includes(task.id) && (
                          <div className="divide-y divide-slate-100">
                            {task.items.map((item, itemIndex) => {
                              const checked = item.completed;
                              const isVerificationStep =
                                isVerificationItem(item);
                              const ItemWrapper = isVerificationStep
                                ? "div"
                                : "label";
                              const previousRequiredItemsInPhase = task.items
                                .slice(0, itemIndex)
                                .filter(
                                  (previousItem) =>
                                    isRequiredChecklistItem(previousItem) &&
                                    !isVerificationItem(previousItem),
                                );
                              const blockingRequiredItem =
                                previousRequiredItemsInPhase.findLast(
                                  (previousItem) => !previousItem.completed,
                                );
                              const isItemLocked = item.locked;
                              return (
                                <div key={item.id}>
                                  <div
                                    className={cn(
                                      "px-6 py-5 transition-colors",
                                      isItemLocked
                                        ? "bg-slate-100/70"
                                        : "hover:bg-blue-50/40",
                                    )}
                                  >
                                    <ItemWrapper
                                      className={cn(
                                        "flex items-start gap-4",
                                        isVerificationStep
                                          ? "cursor-default"
                                          : isItemLocked
                                            ? "cursor-not-allowed"
                                            : "cursor-pointer",
                                      )}
                                    >
                                      <span className="relative mt-0.5">
                                        {isVerificationStep ? (
                                          <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-sky-200 bg-sky-50 text-sky-700 shadow-sm">
                                            <ShieldCheck className="h-3 w-3" />
                                          </span>
                                        ) : (
                                          <>
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={
                                                isItemLocked ||
                                                checked ||
                                                isSavingCompletion
                                              }
                                              onChange={() =>
                                                requestManualCompletion(
                                                  item.id,
                                                  item.label,
                                                )
                                              }
                                              className="peer sr-only"
                                            />
                                            <span
                                              className={cn(
                                                "flex h-5 w-5 items-center justify-center rounded-sm border bg-white text-white shadow-sm transition",
                                                isItemLocked
                                                  ? "border-slate-300 bg-slate-100 text-slate-300"
                                                  : getImportanceCheckboxClassName(
                                                      item.importance,
                                                    ),
                                              )}
                                            >
                                              <CheckCheck className="h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100" />
                                            </span>
                                          </>
                                        )}
                                      </span>

                                      <div
                                        className={cn(
                                          "min-w-0 flex-1 space-y-2",
                                          isItemLocked && "opacity-60",
                                        )}
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-semibold tabular-nums text-slate-400">
                                            {itemIndex + 1}.
                                          </span>
                                          <p
                                            className={`text-sm leading-6 ${
                                              checked
                                                ? "text-slate-400 line-through"
                                                : "font-medium text-slate-900"
                                            }`}
                                          >
                                            {item.label}
                                          </p>
                                          <span
                                            className={cn(
                                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                                              item.importance === "high"
                                                ? "bg-red-100 text-red-800"
                                                : item.importance === "medium"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-blue-100 text-blue-800",
                                            )}
                                          >
                                            {getImportanceLabel(
                                              item.importance,
                                            )}
                                          </span>
                                          {isVerificationStep && (
                                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                                              Verification
                                            </span>
                                          )}
                                          {isItemLocked && (
                                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                              Waiting
                                            </span>
                                          )}
                                        </div>

                                        {isItemLocked && (
                                          <p className="text-xs leading-5 text-slate-500">
                                            Unlocks after:{" "}
                                            <span className="font-medium text-slate-700">
                                              {blockingRequiredItem?.label ??
                                                "an earlier required step"}
                                            </span>
                                          </p>
                                        )}

                                        {isVerificationStep && (
                                          <p className="text-xs leading-5 text-slate-500">
                                            This milestone is verified
                                            separately and cannot be completed
                                            by ticking the checklist yourself.
                                          </p>
                                        )}

                                        {item.href && (
                                          <div
                                            className={cn(
                                              "flex flex-wrap items-center gap-3",
                                              item.notes && "mb-8",
                                            )}
                                          >
                                            {isItemLocked ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                                {item.hrefLabel ??
                                                  "Open resource"}
                                                <ExternalLink className="h-3.5 w-3.5" />
                                              </span>
                                            ) : (
                                              <a
                                                href={item.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                                              >
                                                {item.hrefLabel ??
                                                  "Open resource"}
                                                <ExternalLink className="h-3.5 w-3.5" />
                                              </a>
                                            )}
                                          </div>
                                        )}

                                        {item.notes && (
                                          <div className="border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-600">
                                            <span className="font-medium text-slate-800">
                                              Note:
                                            </span>
                                            {Array.isArray(item.notes) ? (
                                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                                {item.notes.map((notePoint) => (
                                                  <li
                                                    key={
                                                      typeof notePoint ===
                                                      "string"
                                                        ? notePoint
                                                        : `${notePoint.hrefLabel}-${notePoint.href}`
                                                    }
                                                  >
                                                    {isRichNote(notePoint)
                                                      ? renderRichNote(
                                                          notePoint,
                                                        )
                                                      : notePoint}
                                                  </li>
                                                ))}
                                              </ul>
                                            ) : isRichNote(item.notes) ? (
                                              renderRichNote(item.notes)
                                            ) : (
                                              <span> {item.notes}</span>
                                            )}
                                          </div>
                                        )}

                                        {isFirstIssueClaimItem(item) &&
                                          !isItemLocked && (
                                            <JourneyVerificationCard
                                              accentBorderClassName="border-amber-100"
                                              accentButtonClassName="bg-amber-700 text-white hover:bg-amber-800"
                                              accentHeaderClassName="text-amber-700"
                                              accentInputClassName="border-amber-200"
                                              buttonLabel="Verify Claimed Issue"
                                              description="Paste the link to the issue or claim thread you used for your first assignment. This will later confirm that the issue was actually claimed by you."
                                              helperText="Use the full issue URL or the exact thread where you claimed the issue."
                                              inputId="first-issue-link"
                                              inputLabel="First Issue Claim Link"
                                              inputPlaceholder="https://github.com/oppia/oppia/issues/12345"
                                              inputValue={firstIssueLink}
                                              onButtonClick={
                                                openFirstIssueDialog
                                              }
                                              onInputChange={setFirstIssueLink}
                                              sectionLabel="First Issue Claim Verification"
                                              title="Verify Your First Claimed Issue"
                                            />
                                          )}

                                        {isFirstPrMergeItem(item) &&
                                          !isItemLocked && (
                                            <JourneyVerificationCard
                                              accentBorderClassName="border-sky-100"
                                              accentButtonClassName="bg-sky-700 text-white hover:bg-sky-800"
                                              accentHeaderClassName="text-sky-700"
                                              accentInputClassName="border-sky-200"
                                              buttonLabel="Verify Merge PR"
                                              description="Paste the link to your first pull request. This will later confirm whether the PR was actually merged, rather than relying on a manual checkbox."
                                              helperText="Use the full GitHub pull request URL for your first merged PR."
                                              inputId="first-pr-link"
                                              inputLabel="First PR Link"
                                              inputPlaceholder="https://github.com/oppia/oppia/pull/12345"
                                              inputValue={firstPrLink}
                                              onButtonClick={openFirstPrDialog}
                                              onInputChange={setFirstPrLink}
                                              sectionLabel="First PR Verification"
                                              title="Verify Your First Merged PR"
                                            />
                                          )}

                                        {isSecondPrMergeItem(item) &&
                                          !isItemLocked && (
                                            <JourneyVerificationCard
                                              accentBorderClassName="border-emerald-100"
                                              accentButtonClassName="bg-emerald-700 text-white hover:bg-emerald-800"
                                              accentHeaderClassName="text-emerald-700"
                                              accentInputClassName="border-emerald-200"
                                              buttonLabel="Verify Second PR"
                                              description="Paste the link to your second merged pull request. This will later confirm the second milestone from real GitHub activity rather than using a manual checkbox."
                                              helperText="Use the full GitHub pull request URL for your second merged PR."
                                              inputId="second-pr-link"
                                              inputLabel="Second PR Link"
                                              inputPlaceholder="https://github.com/oppia/oppia/pull/23456"
                                              inputValue={secondPrLink}
                                              onButtonClick={openSecondPrDialog}
                                              onInputChange={setSecondPrLink}
                                              sectionLabel="Second PR Verification"
                                              title="Verify Your Second Merged PR"
                                            />
                                          )}

                                        {task.id ===
                                          "phase-3-making-your-first-contribution" &&
                                          item.id === "shortlist_first_issue" &&
                                          (() => {
                                            const previousRequiredActivityItem =
                                              task.items
                                                .slice(0, itemIndex)
                                                .filter(
                                                  (previousItem) =>
                                                    isRequiredChecklistItem(
                                                      previousItem,
                                                    ) &&
                                                    !isVerificationItem(
                                                      previousItem,
                                                    ),
                                                )
                                                .at(-1);
                                            const blockingRequiredActivityItem =
                                              previousRequiredActivityItem &&
                                              !previousRequiredActivityItem.completed
                                                ? previousRequiredActivityItem
                                                : undefined;
                                            const isActivityPanelLocked =
                                              blockingRequiredActivityItem !==
                                              undefined;

                                            return (
                                              <MyContributionJourneyIssueFinder
                                                blockingLabel={
                                                  blockingRequiredActivityItem?.label
                                                }
                                                isLocked={isActivityPanelLocked}
                                                platform={platform}
                                                selectedDomain={
                                                  selectedGfiDomain
                                                }
                                                setSelectedDomain={
                                                  setSelectedGfiDomain
                                                }
                                              />
                                            );
                                          })()}
                                      </div>
                                    </ItemWrapper>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
            </div>

            {isJourneyCompleted && (
              <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-6 py-6">
                <div className="rounded-2xl border border-blue-200 bg-white px-5 py-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Roadmap Completed
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">
                    Hats off to your zeal.
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-700">
                    You have completed the contributor roadmap. A new chapter
                    now begins at Oppia, where you move beyond the starter
                    journey and step closer to becoming a collaborator and part
                    of the internal tech team.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <JourneyVerificationDialog
        activeVerificationDialog={activeVerificationDialog}
        firstIssueLink={sanitizedFirstIssueLink}
        firstPrLink={sanitizedFirstPrLink}
        onOpenChange={(open) => {
          if (!open) {
            setActiveVerificationDialog(null);
          }
        }}
        secondPrLink={sanitizedSecondPrLink}
      />
      <JourneyManualCompletionDialog
        isSubmitting={isSavingCompletion}
        itemLabel={pendingCompletionItem?.label ?? null}
        onConfirm={confirmManualCompletion}
        onOpenChange={(open) => {
          if (!open && !isSavingCompletion) {
            setPendingCompletionItem(null);
          }
        }}
        open={pendingCompletionItem !== null}
      />
    </>
  );
}
