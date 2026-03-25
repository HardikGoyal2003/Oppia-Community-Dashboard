"use client";

import { type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { useActiveSidebarTab } from "./sidebar.store";

export function SideBarTabs({
  projects,
}: {
  projects: {
    name: string;
    icon: LucideIcon;
  }[];
}) {
  const updateActiveSidebarTab = useActiveSidebarTab(
    (state) => state.updateActiveSidebarTab,
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem
            key={item.name}
            onClick={() => updateActiveSidebarTab(item.name)}
          >
            <SidebarMenuButton asChild tooltip={item.name}>
              <div>
                <item.icon />
                <span>{item.name}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
