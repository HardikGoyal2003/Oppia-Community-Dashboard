"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  Bug,
  Inbox,
  LayoutDashboard,
  Map,
  Shield,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/auth/auth.types";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { SidebarNavigationItem } from "@/components/layout/sidebar/sidebar-tabs";

function getSidebarItems(role: UserRole): SidebarNavigationItem[] {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return [
        {
          name: "Incoming Requests",
          icon: Inbox,
          url: "/dashboard/incoming-requests",
        },
        {
          name: "User Role Manager",
          icon: Users,
          url: "/dashboard/user-role-manager",
        },
        {
          name: "Team Reports",
          icon: BarChart3,
          url: "/dashboard/team-reports",
        },
        {
          name: "Reviewer Reports",
          icon: Shield,
          url: "/dashboard/reviewer-teams",
        },
        {
          name: "Unanswered Issue",
          icon: Bug,
          url: "/dashboard/unanswered-issues",
        },
      ];
    case "TEAM_LEAD":
      return [
        { name: "Overview", icon: LayoutDashboard, url: "/dashboard/overview" },
        {
          name: "Unanswered Issues",
          icon: Bug,
          url: "/dashboard/unanswered-issues",
        },
      ];
    case "LEAD_TRAINEE":
      return [
        { name: "Overview", icon: LayoutDashboard, url: "/dashboard/overview" },
        {
          name: "Unanswered Issues",
          icon: Bug,
          url: "/dashboard/unanswered-issues",
        },
      ];
    case "TEAM_MEMBER":
      return [
        { name: "Overview", icon: LayoutDashboard, url: "/dashboard/overview" },
      ];
    default:
      return [
        { name: "Overview", icon: LayoutDashboard, url: "/dashboard/overview" },
        {
          name: "My Contribution Journey",
          icon: Map,
          url: "/dashboard/my-contribution-journey",
        },
      ];
  }
}

export function DashboardShell({
  children,
  role,
}: {
  children: ReactNode;
  role: UserRole;
}) {
  const sidebarItems = getSidebarItems(role);

  return (
    <SidebarProvider>
      <AppSidebar items={sidebarItems} />
      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />
        <div className="min-h-screen bg-gray-50 px-6 py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
