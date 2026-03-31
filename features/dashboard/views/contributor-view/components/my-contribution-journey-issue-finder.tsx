"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/classnames.utils";

export type GfiDomain = "FRONTEND" | "BACKEND" | "FULLSTACK";

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

const HOW_TO_CHOOSE_STEPS = [
  "Pick an issue whose title genuinely interests you.",
  "Read the issue description carefully two or three times until you have a reasonable understanding of the problem.",
  "If anything feels unclear, ask a focused question in the issue thread instead of making assumptions.",
  "Once you have a rough idea of the issue, read the full discussion thread to understand what has already been tried and whether there are hints that can help you get started.",
  "Start the dev server with `python -m scripts.start` and try to reproduce the issue locally using the steps in the issue description.",
  "If you are able to understand the issue, reproduce it, and make progress on a local fix, that is a strong sign that this is a good first issue for you to claim.",
];

function getDomainLabel(domain: GfiDomain): string {
  if (domain === "FULLSTACK") {
    return "Fullstack";
  }

  if (domain === "FRONTEND") {
    return "Frontend";
  }

  return "Backend";
}

export default function MyContributionJourneyIssueFinder({
  blockingLabel,
  isLocked,
  selectedDomain,
  setSelectedDomain,
}: {
  blockingLabel?: string;
  isLocked: boolean;
  selectedDomain: GfiDomain;
  setSelectedDomain: (domain: GfiDomain) => void;
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
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["FRONTEND", "BACKEND", "FULLSTACK"] as GfiDomain[]).map(
              (domain) => (
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
              ),
            )}
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
                {GFI_DOMAIN_LINKS[selectedDomain].description}
              </p>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {GFI_DOMAIN_LINKS[selectedDomain].label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              ) : (
                <a
                  href={GFI_DOMAIN_LINKS[selectedDomain].href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  {GFI_DOMAIN_LINKS[selectedDomain].label}
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
