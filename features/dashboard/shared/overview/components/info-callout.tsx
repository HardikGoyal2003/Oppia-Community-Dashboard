import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/classnames.utils";

/**
 * Informational card used for non-metric messaging on overview pages.
 */
export function InfoCallout({
  icon: Icon,
  title,
  description,
  tone = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "default" | "accent";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        tone === "accent"
          ? "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white"
          : "border-slate-200 bg-white",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tone === "accent"
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </section>
  );
}
