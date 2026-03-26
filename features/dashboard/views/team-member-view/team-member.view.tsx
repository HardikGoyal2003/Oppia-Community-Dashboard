"use client";

import { useState } from "react";
import { Bug, LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";
import { SideBarTabs } from "@/components/layout/sidebar/sidebar-tabs";
import { Navbar } from "@/components/layout/navbar";
import UnansweredIssuesTab from "../../shared/unanswered-issues.tab";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type TeamMemberSidebarTab = "OVERVIEW" | "UNANSWERED_ISSUES";

export default function TeamMemberView() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TeamMemberSidebarTab>("OVERVIEW");
  const isLeadTrainee = session?.user?.role === "LEAD_TRAINEE";
  const sidebarItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
    },
    ...(isLeadTrainee
      ? [
          {
            name: "Unanswered Issues",
            icon: Bug,
          },
        ]
      : []),
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SideBarTabs
            items={sidebarItems}
            activeItemName={
              activeTab === "UNANSWERED_ISSUES"
                ? "Unanswered Issues"
                : "Overview"
            }
            onItemSelect={(itemName) => {
              setActiveTab(
                itemName === "Unanswered Issues"
                  ? "UNANSWERED_ISSUES"
                  : "OVERVIEW",
              );
            }}
          />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        {activeTab === "OVERVIEW" ? (
          <div className="min-h-screen bg-gray-50 px-4 py-10 md:px-6">
            <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
              <div className="max-w-xl rounded-lg border bg-white p-6 text-center shadow-sm">
                <h1 className="mb-2 text-xl font-semibold">
                  Team Dashboard Coming Soon 🚧
                </h1>
                <p className="text-gray-600">
                  We’re working on a dashboard tailored for team members. Stay
                  tuned!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <UnansweredIssuesTab />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
