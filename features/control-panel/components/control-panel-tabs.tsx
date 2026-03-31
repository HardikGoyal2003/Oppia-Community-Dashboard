"use client";

import { useState } from "react";
import { AnnouncementBannerPanel } from "./announcement-banner-panel";
import { CronJobsPanel } from "./cron-jobs-panel";
import { DataJobsPanel } from "./data-jobs-panel";

type ControlPanelTab = "CRON_JOBS" | "DATA_JOBS" | "PLATFORM_PARAMETERS";

const TAB_LABELS: Record<ControlPanelTab, string> = {
  CRON_JOBS: "Cron Jobs",
  DATA_JOBS: "Data Jobs",
  PLATFORM_PARAMETERS: "Platform Parameters",
};

type ControlPanelTabsProps = {
  showCronJobs: boolean;
};

export function ControlPanelTabs({ showCronJobs }: ControlPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<ControlPanelTab>(
    showCronJobs ? "CRON_JOBS" : "DATA_JOBS",
  );
  const tabs = (Object.keys(TAB_LABELS) as ControlPanelTab[]).filter(
    (tab) => showCronJobs || tab !== "CRON_JOBS",
  );

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
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

      {showCronJobs && activeTab === "CRON_JOBS" && <CronJobsPanel />}

      {activeTab === "DATA_JOBS" && <DataJobsPanel />}

      {activeTab === "PLATFORM_PARAMETERS" && (
        <div className="grid gap-6 md:grid-cols-2">
          <AnnouncementBannerPanel />
        </div>
      )}
    </div>
  );
}
