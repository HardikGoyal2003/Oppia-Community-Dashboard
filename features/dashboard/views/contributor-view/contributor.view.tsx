"use client";

import { useState } from "react";
import { LayoutDashboard, Map } from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ContributorOverviewTab from "./components/contributor-overview.tab";
import MyContributionJourneyTab from "./components/my-contribution-journey.tab";

type ContributorSidebarTab = "OVERVIEW" | "MY_CONTRIBUTION_JOURNEY";

export default function ContributorView({
  message = "Thanks for signing up! You’ll get access once you’re assigned to a team.",
  platform,
}: {
  message?: string;
  platform: ContributionPlatform;
}) {
  const [activeTab, setActiveTab] = useState<ContributorSidebarTab>("OVERVIEW");
  const sidebarItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
    },
    {
      name: "My Contribution Journey",
      icon: Map,
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        items={sidebarItems}
        activeItemName={
          activeTab === "MY_CONTRIBUTION_JOURNEY"
            ? "My Contribution Journey"
            : "Overview"
        }
        onItemSelect={(itemName) => {
          setActiveTab(
            itemName === "My Contribution Journey"
              ? "MY_CONTRIBUTION_JOURNEY"
              : "OVERVIEW",
          );
        }}
      />

      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        {activeTab === "OVERVIEW" ? (
          <ContributorOverviewTab
            message={message}
            onStartRoadmap={() => setActiveTab("MY_CONTRIBUTION_JOURNEY")}
            platform={platform}
          />
        ) : (
          <MyContributionJourneyTab platform={platform} />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
