"use client";

import { useState } from "react";
import { AnnouncementBannerPanel } from "./announcement-banner-panel";

type ControlPanelTab = "BEAM_JOBS" | "PLATFORM_PARAMETERS";

const TAB_LABELS: Record<ControlPanelTab, string> = {
  BEAM_JOBS: "Beam Jobs",
  PLATFORM_PARAMETERS: "Platform Parameters",
};

export function ControlPanelTabs() {
  const [activeTab, setActiveTab] = useState<ControlPanelTab>(
    "PLATFORM_PARAMETERS",
  );

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {(Object.keys(TAB_LABELS) as ControlPanelTab[]).map((tab) => (
          <button
            key={tab}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "BEAM_JOBS" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Beam Jobs</h2>
          <p className="mt-2 text-sm text-slate-600">
            Run and monitor operational data jobs from this section.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Beam jobs UI pending implementation.
          </div>
        </section>
      )}

      {activeTab === "PLATFORM_PARAMETERS" && (
        <div className="grid gap-6 md:grid-cols-2">
          <AnnouncementBannerPanel />
        </div>
      )}
    </div>
  );
}
