"use client";

import { useState } from "react";
import { AnnouncementBannerPanel } from "./announcement-banner-panel";
import { DataJobsPanel } from "./data-jobs-panel";

type ControlPanelTab = "DATA_JOBS" | "PLATFORM_PARAMETERS";

const TAB_LABELS: Record<ControlPanelTab, string> = {
  DATA_JOBS: "Data Jobs",
  PLATFORM_PARAMETERS: "Platform Parameters",
};

export function ControlPanelTabs() {
  const [activeTab, setActiveTab] = useState<ControlPanelTab>("DATA_JOBS");

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

      {activeTab === "DATA_JOBS" && <DataJobsPanel />}

      {activeTab === "PLATFORM_PARAMETERS" && (
        <div className="grid gap-6 md:grid-cols-2">
          <AnnouncementBannerPanel />
        </div>
      )}
    </div>
  );
}
