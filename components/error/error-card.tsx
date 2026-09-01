import type { ErrorCodeMeta } from "@/lib/errors/error-codes";
import { ErrorPageIllustration } from "./error-page-illustration";

/**
 * Renders the error card content for a given error code.
 *
 * Reused by the standalone `/error/:errorCode` page and inline within
 * dashboard tabs so the route can stay the same while the page changes.
 */
export function ErrorCard({ meta }: { meta: ErrorCodeMeta }) {
  return (
    <div className="w-full max-w-[585px] rounded-lg border border-slate-200 bg-white px-8 py-12 text-center shadow-sm sm:px-12">
      <h1 className="text-3xl font-bold text-slate-900">{meta.heading}</h1>

      <ErrorPageIllustration />

      <p className="mt-8 text-2xl font-bold leading-snug text-slate-900">
        {meta.message}
      </p>

      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">
        {meta.description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a
          href={meta.homePageHref}
          className="text-sm font-medium text-[#1a73e8] transition hover:underline"
        >
          Return to home page
        </a>
        <span className="text-slate-300">•</span>
        <a
          href={meta.issueTrackerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#1a73e8] transition hover:underline"
        >
          Report this issue
        </a>
      </div>
    </div>
  );
}
