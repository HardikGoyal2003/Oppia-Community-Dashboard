"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { IncomingRequestTab } from "../tabs/incoming-request.tab";
import { UserRoleManagerTab } from "../tabs/user-role-manager.tab";
import { useState } from "react";
import { useActiveSidebarTab } from "../stores/sidebar.store";
import UnansweredIssuesTab from "../tabs/unanswered-issues.tab";

type SidebarTab =
  | 'INCOMING_REQUEST_TAB'
  | 'USER_ROLE_MANAGER_TAB'
  | 'UNANSWERED_ISSUES_TAB'

export default function TechLeadView() {
  const [activetab, setActiveTab] = useState<SidebarTab>(
    'INCOMING_REQUEST_TAB'
  );

  const activeSidebarTab = useActiveSidebarTab((state) => state.activeSidebarTab);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>

        <div className="min-h-screen bg-gray-50 px-6 py-10">
          {activeSidebarTab === 'INCOMING_REQUEST_TAB' && (
            <IncomingRequestTab />
          )}

          {activeSidebarTab === 'USER_ROLE_MANAGER_TAB' && (
            <UserRoleManagerTab />
          )}

          {activeSidebarTab === 'UNANSWERED_ISSUES_TAB' && (
            <UnansweredIssuesTab />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
