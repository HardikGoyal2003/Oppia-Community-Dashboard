"use client";

import * as React from "react";
import { SideBarTabs, type SidebarNavigationItem } from "./sidebar-tabs";
import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  items: SidebarNavigationItem[];
};

export function AppSidebar({ items, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SideBarTabs items={items} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
