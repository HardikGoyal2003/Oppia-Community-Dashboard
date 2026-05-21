import type {
  StatusSummary,
  StatusVariant,
  TeamReport,
} from "./overview.types";

export const GFI_DOMAIN_COLORS = {
  backend: "#2563eb",
  frontend: "#14b8a6",
  fullstack: "#f59e0b",
  uncategorized: "#94a3b8",
} as const;

export const STAT_CARD_STYLES = [
  {
    accent: "from-blue-600 to-blue-400",
    bg: "bg-blue-50",
    icon: "text-blue-600",
    gradient: "from-blue-50/50",
  },
  {
    accent: "from-emerald-500 to-emerald-400",
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    gradient: "from-emerald-50/50",
  },
  {
    accent: "from-violet-500 to-violet-400",
    bg: "bg-violet-50",
    icon: "text-violet-600",
    gradient: "from-violet-50/50",
  },
  {
    accent: "from-amber-500 to-amber-400",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    gradient: "from-amber-50/50",
  },
];

export const CHART_GRADIENT_ID = "unanswered-issues-gradient";

export function formatChartTickLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

export function formatChartTooltipLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

export function getCurrentUnansweredIssuesCount(report: TeamReport): number {
  return report.metrics.at(-1)?.unansweredIssuesCount ?? 0;
}

export function getStatusSummary(report: TeamReport): StatusSummary {
  const currentUnansweredIssues = getCurrentUnansweredIssuesCount(report);
  const highPriorityStepCount = report.nextSteps.filter(
    (step) => step.priority === "high",
  ).length;

  if (highPriorityStepCount > 0 || currentUnansweredIssues >= 12) {
    return {
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      description:
        "Your backlog or staffing needs attention before it starts slowing down contributor support.",
      label: "Needs attention",
    };
  }

  if (currentUnansweredIssues >= 6 || report.nextSteps.length > 0) {
    return {
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
      description:
        "Your team is stable, with a few follow-ups worth scheduling soon.",
      label: "Stable",
    };
  }

  return {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description:
      "Backlog, coverage, and staffing look healthy with no immediate action flagged.",
    label: "Healthy",
  };
}

export function getTotalGfiCount(counts: TeamReport["gfiCounts"]): number {
  return (
    counts.backend + counts.frontend + counts.fullstack + counts.uncategorized
  );
}

export function getTeamLeadActionMessage(message: string): string {
  if (message.startsWith("Ask leads to add ")) {
    return message.replace(/^Ask leads to add /, "Add ");
  }

  if (
    message ===
    "Ask leads about the team\u2019s issue response performance because unanswered issues are consistently growing."
  ) {
    return "Review your team\u2019s issue response performance because unanswered issues are consistently growing.";
  }

  if (
    message ===
    "Ask leads to categorize uncategorized good first issues into frontend, backend, or fullstack."
  ) {
    return "Categorize uncategorized good first issues into frontend, backend, or fullstack.";
  }

  if (message === "It is better to onboard one trainee lead in this team.") {
    return "Onboard one trainee lead in your team.";
  }

  if (message.startsWith("Onboard ")) {
    return message.replace(/in this team\.$/, "in your team.");
  }

  return message;
}

export function getStatusVariant(label: string): StatusVariant {
  if (label === "Needs attention") {
    return { dot: "bg-amber-500", ring: "ring-amber-200" };
  }
  if (label === "Stable") {
    return { dot: "bg-sky-500", ring: "ring-sky-200" };
  }
  return { dot: "bg-emerald-500", ring: "ring-emerald-200" };
}
