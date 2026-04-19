"use client";

import { ExternalLink } from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { cn } from "@/lib/utils/classnames.utils";

export type GfiDomain =
  | "FRONTEND"
  | "BACKEND"
  | "FULLSTACK"
  | "LEARNER_FACING"
  | "DEVELOPER_FACING";

const WEB_GFI_DOMAIN_METADATA: Record<
  "BACKEND" | "FRONTEND" | "FULLSTACK",
  {
    description: string;
    label: string;
    queryLabel: string;
  }
> = {
  BACKEND: {
    description:
      "Browse unassigned backend good first issues so you can explore starter work aligned with backend-focused tasks.",
    label: "Open backend GFIs on GitHub",
    queryLabel: "backend",
  },
  FRONTEND: {
    description:
      "Browse unassigned frontend good first issues if you want UI, HTML, CSS, or TypeScript-heavy work.",
    label: "Open frontend GFIs on GitHub",
    queryLabel: "frontend",
  },
  FULLSTACK: {
    description:
      "Browse unassigned fullstack good first issues if you want work that spans both frontend and backend concerns.",
    label: "Open fullstack GFIs on GitHub",
    queryLabel: "full-stack",
  },
};

const ANDROID_GFI_DOMAIN_METADATA: Record<
  "DEVELOPER_FACING" | "LEARNER_FACING",
  {
    description: string;
    label: string;
    url: string;
  }
> = {
  DEVELOPER_FACING: {
    description:
      "Browse unassigned developer-facing good first issues if you want tooling, infrastructure, or contributor-workflow improvements.",
    label: "Open developer-facing GFIs on GitHub",
    url: "https://github.com/oppia/oppia-android/issues?q=is%3Aissue%20state%3Aopen%20no%3Aassignee%20label%3A%22good%20first%20issue%22%20project%3Aoppia%2F10",
  },
  LEARNER_FACING: {
    description:
      "Browse unassigned learner-facing good first issues if you want user-visible Android app work focused on the learner experience.",
    label: "Open learner-facing GFIs on GitHub",
    url: "https://github.com/oppia/oppia-android/issues?q=is%3Aissue%20state%3Aopen%20no%3Aassignee%20label%3A%22good%20first%20issue%22%20project%3Aoppia%2F4",
  },
};

const HOW_TO_CHOOSE_STEPS = [
  "Pick an issue whose title genuinely interests you.",
  "Read the issue description carefully two or three times until you have a reasonable understanding of the problem.",
  "If anything feels unclear, ask a focused question in the issue thread instead of making assumptions.",
  "Once you have a rough idea of the issue, read the full discussion thread to understand what has already been tried and whether there are hints that can help you get started.",
  "Start the dev server with `python -m scripts.start` and try to reproduce the issue locally using the steps in the issue description.",
  "If you are able to understand the issue, reproduce it, and make progress on a local fix, that is a strong sign that this is a good first issue for you to claim.",
];

function getDomainLabel(domain: GfiDomain): string {
  if (domain === "LEARNER_FACING") {
    return "Learner Facing";
  }

  if (domain === "DEVELOPER_FACING") {
    return "Developer Facing";
  }

  if (domain === "FULLSTACK") {
    return "Fullstack";
  }

  if (domain === "FRONTEND") {
    return "Frontend";
  }

  return "Backend";
}

/**
 * Builds the live GitHub issue-filter URL for a platform/domain pair.
 *
 * @param platform The selected contribution platform.
 * @param domain The selected good-first-issue domain.
 * @returns The GitHub issues URL with the matching filters.
 */
function getGfiDomainLink(
  platform: ContributionPlatform,
  domain: GfiDomain,
): string {
  if (platform === "ANDROID") {
    return ANDROID_GFI_DOMAIN_METADATA[
      domain as keyof typeof ANDROID_GFI_DOMAIN_METADATA
    ].url;
  }

  const repoTarget = GITHUB_REPOS[platform];
  const metadata =
    WEB_GFI_DOMAIN_METADATA[domain as keyof typeof WEB_GFI_DOMAIN_METADATA];
  const searchQuery = `is:issue state:open no:assignee label:"good first issue" label:${metadata.queryLabel}`;

  return `https://github.com/${repoTarget.owner}/${repoTarget.repo}/issues?q=${encodeURIComponent(searchQuery)}`;
}

function getDomainOptions(platform: ContributionPlatform): GfiDomain[] {
  if (platform === "ANDROID") {
    return ["LEARNER_FACING", "DEVELOPER_FACING"];
  }

  return ["FRONTEND", "BACKEND", "FULLSTACK"];
}

function getSelectedDomainMetadata(
  platform: ContributionPlatform,
  domain: GfiDomain,
): {
  description: string;
  label: string;
} {
  if (platform === "ANDROID") {
    return ANDROID_GFI_DOMAIN_METADATA[
      domain as keyof typeof ANDROID_GFI_DOMAIN_METADATA
    ];
  }

  return WEB_GFI_DOMAIN_METADATA[
    domain as keyof typeof WEB_GFI_DOMAIN_METADATA
  ];
}

export default function MyContributionJourneyIssueFinder({
  blockingLabel,
  isLocked,
  platform,
  selectedDomain,
  setSelectedDomain,
}: {
  blockingLabel?: string;
  isLocked: boolean;
  platform: ContributionPlatform;
  selectedDomain: GfiDomain;
  setSelectedDomain: (domain: GfiDomain) => void;
}) {
  const domainOptions = getDomainOptions(platform);
  const selectedDomainMetadata = getSelectedDomainMetadata(
    platform,
    selectedDomain,
  );

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
          GitHub issue filters by domain.
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

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {domainOptions.map((domain) => (
              <button
                key={domain}
                type="button"
                disabled={isLocked}
                onClick={() => setSelectedDomain(domain)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition",
                  isLocked
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    : selectedDomain === domain
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                {getDomainLabel(domain)}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                  {getDomainLabel(selectedDomain)}
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-green-800">
                  Real GitHub filter
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-700">
                {selectedDomainMetadata.description}
              </p>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {selectedDomainMetadata.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              ) : (
                <a
                  href={getGfiDomainLink(platform, selectedDomain)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  {selectedDomainMetadata.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
