"use client";

import { useState } from "react";
import { Bug } from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import UnansweredIssuesTab from "../../shared/unanswered-issues.tab";
import TeamLeadOverviewTab from "./tabs/overview.tab";

type TeamLeadSidebarTab = "OVERVIEW" | "UNANSWERED_ISSUES";

export default function TeamLeadView() {
  const [activeTab, setActiveTab] = useState<TeamLeadSidebarTab>("OVERVIEW");
  const sidebarItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
    },
    {
      name: "Unanswered Issues",
      icon: Bug,
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        items={sidebarItems}
        activeItemName={
          activeTab === "UNANSWERED_ISSUES" ? "Unanswered Issues" : "Overview"
        }
        onItemSelect={(itemName) => {
          setActiveTab(
            itemName === "Unanswered Issues" ? "UNANSWERED_ISSUES" : "OVERVIEW",
          );
        }}
      />
      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        <div className="min-h-screen bg-gray-50 px-6 py-10">
          {activeTab === "OVERVIEW" ? (
            <TeamLeadOverviewTab />
          ) : (
            <UnansweredIssuesTab />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
