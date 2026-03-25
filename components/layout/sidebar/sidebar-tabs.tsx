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

export type SidebarNavigationItem = {
  name: string;
  icon: LucideIcon;
};

export function SideBarTabs({
  items,
  activeItemName,
  onItemSelect,
}: {
  items: SidebarNavigationItem[];
  activeItemName?: string;
  onItemSelect?: (itemName: string) => void;
}) {
  const updateActiveSidebarTab = useActiveSidebarTab(
    (state) => state.updateActiveSidebarTab,
  );
  const handleItemSelect = onItemSelect ?? updateActiveSidebarTab;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.name}
            onClick={() => handleItemSelect(item.name)}
          >
            <SidebarMenuButton
              asChild
              tooltip={item.name}
              isActive={activeItemName === item.name}
            >
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
