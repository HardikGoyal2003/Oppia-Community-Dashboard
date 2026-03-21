"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import { IncomingRequestTab } from "./tabs/incoming-request.tab";
import { UserRoleManagerTab } from "./tabs/user-role-manager.tab";
import { useActiveSidebarTab } from "../../../../components/layout/sidebar/sidebar.store";
import UnansweredIssuesTab from "../../shared/unanswered-issues.tab";

export default function TechLeadView() {
  const activeSidebarTab = useActiveSidebarTab(
    (state) => state.activeSidebarTab,
  );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        <div className="min-h-screen bg-gray-50 px-6 py-10">
          {activeSidebarTab === "INCOMING_REQUEST_TAB" && (
            <IncomingRequestTab />
          )}

          {activeSidebarTab === "USER_ROLE_MANAGER_TAB" && (
            <UserRoleManagerTab />
          )}

          {activeSidebarTab === "UNANSWERED_ISSUES_TAB" && (
            <UnansweredIssuesTab />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
