"use client";

import { ExternalLink } from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { cn } from "@/lib/utils/classnames.utils";

const HOW_TO_CHOOSE_STEPS = [
  "Pick an issue whose title genuinely interests you.",
  "Read the issue description carefully two or three times until you have a reasonable understanding of the problem.",
  "If anything feels unclear, ask a focused question in the issue thread instead of making assumptions.",
  "Once you have a rough idea of the issue, read the full discussion thread to understand what has already been tried and whether there are hints that can help you get started.",
  "Start the dev server with `python -m scripts.start` and try to reproduce the issue locally using the steps in the issue description.",
  "If you are able to understand the issue, reproduce it, and make progress on a local fix, that is a strong sign that this is a good first issue for you to claim.",
];

/**
 * Builds the live GitHub issue-filter URL for all open unassigned GFIs.
 *
 * @param platform The selected contribution platform.
 * @returns The GitHub issues URL with the matching filters.
 */
function getGfiLink(platform: ContributionPlatform): string {
  const repoTarget = GITHUB_REPOS[platform];
  const searchQuery = `is:issue state:open no:assignee label:"good first issue"`;

  return `https://github.com/${repoTarget.owner}/${repoTarget.repo}/issues?q=${encodeURIComponent(searchQuery)}`;
}

export default function MyContributionJourneyIssueFinder({
  blockingLabel,
  isLocked,
  platform,
}: {
  blockingLabel?: string;
  isLocked: boolean;
  platform: ContributionPlatform;
}) {
  return (
    <div
      className={cn(
        "mt-8 rounded-2xl border border-slate-200 bg-slate-50/90 p-5",
        isLocked && "opacity-60",
      )}
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Find Your First Issue
        </p>
        <p className="text-sm leading-6 text-slate-600">
          Use this mini guide to narrow your search, then jump to the real
          GitHub issue filter.
        </p>
        {isLocked && (
          <p className="text-xs leading-5 text-slate-500">
            Unlocks after:{" "}
            <span className="font-medium text-slate-700">{blockingLabel}</span>
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
              {HOW_TO_CHOOSE_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 text-xs font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border-l-4 border-blue-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              <span className="font-semibold text-slate-900">Note:</span> At the
              beginning, try to pick only{" "}
              <span className="font-semibold text-slate-900">
                good first issues
              </span>
              . They are intentionally more beginner-friendly and are usually
              much more approachable than non-GFI issues.
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-green-800">
                Real GitHub filter
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-700">
              Browse unassigned good first issues and find starter work that
              matches your interests.
            </p>
            {isLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                Open GFIs on GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            ) : (
              <a
                href={getGfiLink(platform)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
              >
                Open GFIs on GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
