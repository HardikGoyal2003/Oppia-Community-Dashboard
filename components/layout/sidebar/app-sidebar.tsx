"use client";

import * as React from "react";
import { SideBarTabs, type SidebarNavigationItem } from "./sidebar-tabs";
import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  items: SidebarNavigationItem[];
  activeItemName?: string;
  onItemSelect?: (itemName: string) => void;
};

export function AppSidebar({
  items,
  activeItemName,
  onItemSelect,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <SideBarTabs
          items={items}
          activeItemName={activeItemName}
          onItemSelect={onItemSelect}
        />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
