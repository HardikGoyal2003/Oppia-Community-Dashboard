"use client";

import { BarChart3, Bug, Inbox, Users } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import { IncomingRequestTab } from "./tabs/incoming-request.tab";
import { TeamReportsTab } from "./tabs/team-reports.tab";
import { UserRoleManagerTab } from "./tabs/user-role-manager.tab";
import { useActiveSidebarTab } from "../../../../components/layout/sidebar/sidebar.store";
import UnansweredIssuesTab from "../../shared/unanswered-issues.tab";

export default function TechLeadView() {
  const activeSidebarTab = useActiveSidebarTab(
    (state) => state.activeSidebarTab,
  );
  const updateActiveSidebarTab = useActiveSidebarTab(
    (state) => state.updateActiveSidebarTab,
  );
  const sidebarItems = [
    {
      name: "Incoming Requests",
      icon: Inbox,
    },
    {
      name: "User Role Manager",
      icon: Users,
    },
    {
      name: "Team Reports",
      icon: BarChart3,
    },
    {
      name: "Unanswered Issue",
      icon: Bug,
    },
  ];
  const activeItemName =
    activeSidebarTab === "USER_ROLE_MANAGER_TAB"
      ? "User Role Manager"
      : activeSidebarTab === "TEAM_REPORTS_TAB"
        ? "Team Reports"
        : activeSidebarTab === "UNANSWERED_ISSUES_TAB"
          ? "Unanswered Issue"
          : "Incoming Requests";

  return (
    <SidebarProvider>
      <AppSidebar
        items={sidebarItems}
        activeItemName={activeItemName}
        onItemSelect={updateActiveSidebarTab}
      />
      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        <div className="min-h-screen bg-gray-50 px-6 py-10">
          {activeSidebarTab === "INCOMING_REQUEST_TAB" && (
            <IncomingRequestTab />
          )}

          {activeSidebarTab === "USER_ROLE_MANAGER_TAB" && (
            <UserRoleManagerTab />
          )}

          {activeSidebarTab === "TEAM_REPORTS_TAB" && <TeamReportsTab />}

          {activeSidebarTab === "UNANSWERED_ISSUES_TAB" && (
            <UnansweredIssuesTab />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
