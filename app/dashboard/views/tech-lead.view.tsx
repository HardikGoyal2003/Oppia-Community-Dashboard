"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { IncomingRequestTab } from "../tabs/incoming-request.tab";
import { UserRoleManagerTab } from "../tabs/user-role-manager.tab";
import { useState } from "react";

export default function TechLeadView() {
  const [activetab, setActiveTab] = useState<'INCOMING_REQUEST_TAB' | 'USER_ROLE_MANAGER_TAB'>(
    'INCOMING_REQUEST_TAB'
  );

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
          {activetab === 'INCOMING_REQUEST_TAB' && (
            <IncomingRequestTab
              onSelect={() => setActiveTab('INCOMING_REQUEST_TAB')}
            />
          )}

          {activetab === 'USER_ROLE_MANAGER_TAB' && (
            <UserRoleManagerTab
              onSelect={() => setActiveTab('USER_ROLE_MANAGER_TAB')}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
