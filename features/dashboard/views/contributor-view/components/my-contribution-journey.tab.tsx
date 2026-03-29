"use client";

import { useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Flag,
  Lock,
  ListTodo,
} from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  CONTRIBUTOR_JOURNEY_CONTENT,
  type ContributorJourneyChecklistItem,
  type ContributorJourneyRichNote,
} from "@/lib/config";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/classnames.utils";

type GfiDomain = "FRONTEND" | "BACKEND" | "FULLSTACK";

const GFI_DOMAIN_LINKS: Record<
  GfiDomain,
  {
    description: string;
    href: string;
    label: string;
  }
> = {
  BACKEND: {
    description:
      "Browse unassigned backend good first issues so you can explore Python-oriented starter work.",
    href: "https://github.com/oppia/oppia/issues?q=is%3Aissue%20state%3Aopen%20no%3Aassignee%20label%3A%22good%20first%20issue%22%20label%3Abackend",
    label: "Open backend GFIs on GitHub",
  },
  FRONTEND: {
    description:
      "Browse unassigned frontend good first issues if you want UI, Angular, HTML, CSS, or TypeScript-heavy work.",
    href: "https://github.com/oppia/oppia/issues?q=is%3Aissue%20state%3Aopen%20no%3Aassignee%20label%3A%22good%20first%20issue%22%20label%3Afrontend",
    label: "Open frontend GFIs on GitHub",
  },
  FULLSTACK: {
    description:
      "Browse unassigned fullstack good first issues if you want work that spans both frontend and backend concerns.",
    href: "https://github.com/oppia/oppia/issues?q=is%3Aissue%20state%3Aopen%20no%3Aassignee%20label%3A%22good%20first%20issue%22%20label%3Afull-stack",
    label: "Open fullstack GFIs on GitHub",
  },
};

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
    const status = allHighDone
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

        <div className="grid gap-4">
          <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_58%,#0f766e_100%)] px-6 py-6 text-white shadow-[0_28px_65px_-40px_rgba(15,23,42,0.75)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/90">
                  Active Phase
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {activePhase.title}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-200">
                    {journeyContent.tasks.length} phases are currently mapped
                    out in your journey. Start here, then move phase by phase as
                    you build momentum.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200">
                  Progress
                </p>
                <p className="mt-1 text-3xl font-semibold">
                  {progressPercentage}%
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>
                  {completedRequiredCount}/{requiredChecklistItems.length}{" "}
                  required items completed
                </span>
                <span>Keep going</span>
              </div>
              <div className="relative pt-5">
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                {phaseCheckpoints.map((checkpoint) => (
                  <Tooltip key={checkpoint.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${checkpoint.leftPercentage}%` }}
                      >
                        <Flag
                          className={cn(
                            "h-4 w-4",
                            checkpoint.status === "complete"
                              ? "text-emerald-300"
                              : checkpoint.status === "recommended_left"
                                ? "text-red-400"
                                : "text-white/80",
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      <p className="font-medium">{checkpoint.title}</p>
                      {checkpoint.status === "recommended_left" && (
                        <p>Medium tasks are strongly advised to complete.</p>
                      )}
                      {checkpoint.status === "complete" && (
                        <p>All high and medium tasks in this phase are done.</p>
                      )}
                      {checkpoint.status === "in_progress" && (
                        <p>Required tasks in this phase are still pending.</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="text-xs text-slate-300">
                Overall checklist completion: {completedCount}/
                {allChecklistItems.length}
              </p>
            </div>
          </div>
        </div>

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

          <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Before You Start
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>
                  You will need to read some long docs, and you will come across
                  many new terms that may feel overwhelming at first. But
                  remember: you decided to start open source. That already puts
                  you ahead of many people, so keep going and do not stop early.
                </li>
                <li>
                  The more time you invest in reading and understanding the
                  docs, the less time you will usually need later to make code
                  fixes with confidence.
                </li>
                <li>
                  Be open to learning new things and brushing up on the
                  technologies used in Oppia. Most contributors do not begin
                  with every skill fully polished. The important part is being
                  willing to learn as you go.
                </li>
                <li>
                  Focus on one task at a time instead of trying to clear the
                  whole phase at once.
                </li>
              </ul>
            </div>
          </div>

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
                                        <div
                                          className={cn(
                                            "mt-8 rounded-2xl border border-slate-200 bg-slate-50/90 p-5",
                                            isActivityPanelLocked &&
                                              "opacity-60",
                                          )}
                                        >
                                          <div className="space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                              Find Your First Issue
                                            </p>
                                            <p className="text-sm leading-6 text-slate-600">
                                              Use this mini guide to narrow your
                                              search, then jump to the real
                                              GitHub issue filters by domain.
                                            </p>
                                            {isActivityPanelLocked && (
                                              <p className="text-xs leading-5 text-slate-500">
                                                Unlocks after:{" "}
                                                <span className="font-medium text-slate-700">
                                                  {
                                                    blockingRequiredActivityItem?.label
                                                  }
                                                </span>
                                              </p>
                                            )}
                                          </div>

                                          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
                                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                                              <div className="space-y-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                  How to Choose
                                                </p>
                                                <ol className="space-y-2 text-sm leading-6 text-slate-700">
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      1
                                                    </span>
                                                    <span>
                                                      Pick an issue whose title
                                                      genuinely interests you.
                                                    </span>
                                                  </li>
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      2
                                                    </span>
                                                    <span>
                                                      Read the issue description
                                                      carefully two or three
                                                      times until you have a
                                                      reasonable understanding
                                                      of the problem.
                                                    </span>
                                                  </li>
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      3
                                                    </span>
                                                    <span>
                                                      If anything feels unclear,
                                                      ask a focused question in
                                                      the issue thread instead
                                                      of making assumptions.
                                                    </span>
                                                  </li>
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      4
                                                    </span>
                                                    <span>
                                                      Once you have a rough idea
                                                      of the issue, read the
                                                      full discussion thread to
                                                      understand what has
                                                      already been tried and
                                                      whether there are hints
                                                      that can help you get
                                                      started.
                                                    </span>
                                                  </li>
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      5
                                                    </span>
                                                    <span>
                                                      Start the dev server with
                                                      `python -m scripts.start`
                                                      and try to reproduce the
                                                      issue locally using the
                                                      steps in the issue
                                                      description.
                                                    </span>
                                                  </li>
                                                  <li className="flex gap-3">
                                                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                                                      6
                                                    </span>
                                                    <span>
                                                      If you are able to
                                                      understand the issue,
                                                      reproduce it, and make
                                                      progress on a local fix,
                                                      that is a strong sign that
                                                      this is a good first issue
                                                      for you to claim.
                                                    </span>
                                                  </li>
                                                </ol>
                                              </div>
                                            </div>

                                            <div className="space-y-4">
                                              <div className="flex flex-wrap gap-2">
                                                {(
                                                  [
                                                    "FRONTEND",
                                                    "BACKEND",
                                                    "FULLSTACK",
                                                  ] as GfiDomain[]
                                                ).map((domain) => (
                                                  <button
                                                    key={domain}
                                                    type="button"
                                                    disabled={
                                                      isActivityPanelLocked
                                                    }
                                                    onClick={() =>
                                                      setSelectedGfiDomain(
                                                        domain,
                                                      )
                                                    }
                                                    className={cn(
                                                      "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition",
                                                      isActivityPanelLocked
                                                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                                                        : selectedGfiDomain ===
                                                            domain
                                                          ? "border-slate-900 bg-slate-900 text-white"
                                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                                                    )}
                                                  >
                                                    {domain === "FULLSTACK"
                                                      ? "Fullstack"
                                                      : domain === "FRONTEND"
                                                        ? "Frontend"
                                                        : "Backend"}
                                                  </button>
                                                ))}
                                              </div>

                                              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                                                <div className="space-y-3">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                                                      {selectedGfiDomain ===
                                                      "FULLSTACK"
                                                        ? "Fullstack"
                                                        : selectedGfiDomain ===
                                                            "FRONTEND"
                                                          ? "Frontend"
                                                          : "Backend"}
                                                    </span>
                                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-green-800">
                                                      Real GitHub filter
                                                    </span>
                                                  </div>
                                                  <p className="text-sm leading-6 text-slate-700">
                                                    {
                                                      GFI_DOMAIN_LINKS[
                                                        selectedGfiDomain
                                                      ].description
                                                    }
                                                  </p>
                                                  {isActivityPanelLocked ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                                      {
                                                        GFI_DOMAIN_LINKS[
                                                          selectedGfiDomain
                                                        ].label
                                                      }
                                                      <ExternalLink className="h-3.5 w-3.5" />
                                                    </span>
                                                  ) : (
                                                    <a
                                                      href={
                                                        GFI_DOMAIN_LINKS[
                                                          selectedGfiDomain
                                                        ].href
                                                      }
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                      {
                                                        GFI_DOMAIN_LINKS[
                                                          selectedGfiDomain
                                                        ].label
                                                      }
                                                      <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
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
