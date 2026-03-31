"use client";

import { useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Lock,
  ListTodo,
} from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  CONTRIBUTOR_JOURNEY_CONTENT,
  type ContributorJourneyChecklistItem,
  type ContributorJourneyRichNote,
} from "@/lib/config";
import { cn } from "@/lib/utils/classnames.utils";
import MyContributionJourneyBeforeYouStart from "./my-contribution-journey-before-you-start";
import MyContributionJourneyIssueFinder, {
  type GfiDomain,
} from "./my-contribution-journey-issue-finder";
import MyContributionJourneyProgressHero from "./my-contribution-journey-progress-hero";

function getChecklistItemKey(
  taskId: string,
  item: ContributorJourneyChecklistItem,
): string {
  return `${taskId}:${item.label}`;
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

export default function MyContributionJourneyTab({
  platform,
}: {
  platform: ContributionPlatform;
}) {
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [selectedGfiDomain, setSelectedGfiDomain] =
    useState<GfiDomain>("FRONTEND");
  const journeyContent = CONTRIBUTOR_JOURNEY_CONTENT[platform];
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<string[]>([
    journeyContent.tasks[0]?.id ?? "",
  ]);
  const allChecklistItems = journeyContent.tasks.flatMap((task) => task.items);
  const requiredChecklistItems = journeyContent.tasks.flatMap((task) =>
    task.items.filter(isRequiredChecklistItem),
  );
  const completedRequiredCount = journeyContent.tasks.reduce(
    (count, task) =>
      count +
      task.items.filter(
        (item) =>
          isRequiredChecklistItem(item) &&
          completedItems.includes(getChecklistItemKey(task.id, item)),
      ).length,
    0,
  );
  const phasesWithState = journeyContent.tasks.map((task, taskIndex) => {
    const requiredItemsInPreviousPhases = journeyContent.tasks
      .slice(0, taskIndex)
      .flatMap((previousTask) =>
        previousTask.items
          .filter(isRequiredChecklistItem)
          .map((item) => getChecklistItemKey(previousTask.id, item)),
      );
    const isLocked =
      taskIndex > 0 &&
      requiredItemsInPreviousPhases.some(
        (requiredItemKey) => !completedItems.includes(requiredItemKey),
      );
    const completedItemsInTask = completedItems.filter((itemKey) =>
      task.items.some((item) => getChecklistItemKey(task.id, item) === itemKey),
    ).length;

    return {
      completedItemsInTask,
      isLocked,
      task,
    };
  });
  const phaseCheckpoints = journeyContent.tasks.map((task, taskIndex) => {
    const requiredItemsBeforePhase = journeyContent.tasks
      .slice(0, taskIndex + 1)
      .flatMap((currentTask) =>
        currentTask.items.filter(isRequiredChecklistItem),
      ).length;
    const highItems = task.items.filter(isRequiredChecklistItem);
    const mediumItems = task.items.filter(isRecommendedChecklistItem);
    const allHighDone = highItems.every((item) =>
      completedItems.includes(getChecklistItemKey(task.id, item)),
    );
    const allMediumDone = mediumItems.every((item) =>
      completedItems.includes(getChecklistItemKey(task.id, item)),
    );
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

  function toggleCompletedItem(itemLabel: string) {
    setCompletedItems((currentItems) =>
      currentItems.includes(itemLabel)
        ? currentItems.filter((currentItem) => currentItem !== itemLabel)
        : currentItems.concat(itemLabel),
    );
  }

  function toggleExpandedPhase(taskId: string) {
    setExpandedPhaseIds((currentPhaseIds) =>
      currentPhaseIds.includes(taskId)
        ? currentPhaseIds.filter((currentPhaseId) => currentPhaseId !== taskId)
        : currentPhaseIds.concat(taskId),
    );
  }

  const completedCount = completedItems.length;
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
          .filter(isRequiredChecklistItem)
          .some(
            (item) =>
              !completedItems.includes(getChecklistItemKey(task.id, item)),
          ),
    )?.task ??
    phasesWithState.findLast(({ isLocked }) => !isLocked)?.task ??
    journeyContent.tasks[0];

  return (
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
                Finish these setup tasks before you start sending contributions.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 shadow-sm">
              {completedCount} done
            </div>
          </div>

          <MyContributionJourneyBeforeYouStart />

          <div className="divide-y divide-slate-100">
            {phasesWithState.map(({ task, isLocked, completedItemsInTask }) => {
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
                            expandedPhaseIds.includes(task.id) && "rotate-180",
                          )}
                        />
                      )}
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {task.title}
                        </h3>
                        {isLocked && (
                          <p className="text-xs text-slate-500">
                            Complete all required items in earlier phases to
                            unlock this phase.
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {completedItemsInTask}/{task.items.length}
                    </span>
                  </button>

                  {!isLocked && expandedPhaseIds.includes(task.id) && (
                    <div className="divide-y divide-slate-100">
                      {task.items.map((item, itemIndex) => {
                        const itemKey = getChecklistItemKey(task.id, item);
                        const checked = completedItems.includes(itemKey);
                        const previousRequiredItemsInPhase = task.items
                          .slice(0, itemIndex)
                          .filter(isRequiredChecklistItem);
                        const previousRequiredItem =
                          previousRequiredItemsInPhase.at(-1);
                        const blockingRequiredItem =
                          previousRequiredItem &&
                          !completedItems.includes(
                            getChecklistItemKey(task.id, previousRequiredItem),
                          )
                            ? previousRequiredItem
                            : undefined;
                        const isItemLocked = blockingRequiredItem !== undefined;
                        return (
                          <div key={itemKey}>
                            <div
                              className={cn(
                                "px-6 py-5 transition-colors",
                                isItemLocked
                                  ? "bg-slate-100/70"
                                  : "hover:bg-blue-50/40",
                              )}
                            >
                              <label
                                className={cn(
                                  "flex items-start gap-4",
                                  isItemLocked
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer",
                                )}
                              >
                                <span className="relative mt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isItemLocked}
                                    onChange={() =>
                                      toggleCompletedItem(itemKey)
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
                                      {getImportanceLabel(item.importance)}
                                    </span>
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
                                        {blockingRequiredItem.label}
                                      </span>
                                    </p>
                                  )}

                                  {item.description && (
                                    <p className="text-sm leading-6 text-slate-600">
                                      {item.description}
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
                                          {item.hrefLabel ?? "Open resource"}
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </span>
                                      ) : (
                                        <a
                                          href={item.href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                                        >
                                          {item.hrefLabel ?? "Open resource"}
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
                                                typeof notePoint === "string"
                                                  ? notePoint
                                                  : `${notePoint.hrefLabel}-${notePoint.href}`
                                              }
                                            >
                                              {isRichNote(notePoint)
                                                ? renderRichNote(notePoint)
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

                                  {task.id ===
                                    "phase-3-making-your-first-contribution" &&
                                    itemIndex === 2 &&
                                    (() => {
                                      const previousRequiredActivityItem =
                                        task.items
                                          .slice(0, itemIndex)
                                          .filter(isRequiredChecklistItem)
                                          .at(-1);
                                      const blockingRequiredActivityItem =
                                        previousRequiredActivityItem &&
                                        !completedItems.includes(
                                          getChecklistItemKey(
                                            task.id,
                                            previousRequiredActivityItem,
                                          ),
                                        )
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
                                          selectedDomain={selectedGfiDomain}
                                          setSelectedDomain={
                                            setSelectedGfiDomain
                                          }
                                        />
                                      );
                                    })()}
                                </div>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
                  You have completed the contributor roadmap. A new chapter now
                  begins at Oppia, where you move beyond the starter journey and
                  step closer to becoming a collaborator and part of the
                  internal tech team.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
