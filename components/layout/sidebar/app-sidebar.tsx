"use client";

import * as React from "react";
import { Bug, Inbox, Users } from "lucide-react";

import { SideBarTabs } from "./sidebar-tabs";
import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";
import { useActiveSidebarTab } from "./sidebar.store";

const data = {
  items: [
    {
      name: "Incoming Requests",
      icon: Inbox,
    },
    {
      name: "User Role Manager",
      icon: Users,
    },
    {
      name: "Unanswered Issue",
      icon: Bug,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const activeSidebarTab = useActiveSidebarTab(
    (state) => state.activeSidebarTab,
  );
  const activeItemName =
    activeSidebarTab === "USER_ROLE_MANAGER_TAB"
      ? "User Role Manager"
      : activeSidebarTab === "UNANSWERED_ISSUES_TAB"
        ? "Unanswered Issue"
        : "Incoming Requests";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SideBarTabs items={data.items} activeItemName={activeItemName} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
