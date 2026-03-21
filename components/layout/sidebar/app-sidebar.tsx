"use client";

import * as React from "react";
import { Bug, Inbox, Users } from "lucide-react";

import { SideBarTabs } from "./sidebar-tabs";
import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";

const data = {
  projects: [
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
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SideBarTabs projects={data.projects} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
