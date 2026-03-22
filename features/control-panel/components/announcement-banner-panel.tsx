"use client";

import { CONSTANTS } from "@/lib/constants";

export function AnnouncementBannerPanel() {
  const title = CONSTANTS.ANNOUNCEMENT_BANNER.TITLE;
  const message = CONSTANTS.ANNOUNCEMENT_BANNER.MESSAGE;
  const isEnabled = CONSTANTS.ANNOUNCEMENT_BANNER.IS_ENABLED;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Announcement Banner
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            The announcement banner is now hardcoded to avoid runtime server
            calls. Update it in <code>lib/constants.ts</code> and redeploy.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {isEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Title
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {title || "No title configured"}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Message
          </label>
          <div className="min-h-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {message || "No message configured"}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        This panel is read-only. Change the banner values in{" "}
        <code>lib/constants.ts</code>.
      </p>
    </section>
  );
}
