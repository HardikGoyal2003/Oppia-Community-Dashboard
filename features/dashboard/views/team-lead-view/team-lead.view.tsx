"use client";

import { Bug } from "lucide-react";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import UnansweredIssuesTab from "../../shared/unanswered-issues.tab";

export default function TeamLeadView() {
  const sidebarItems = [
    {
      name: "Unanswered Issue",
      icon: Bug,
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        items={sidebarItems}
        activeItemName="Unanswered Issue"
        onItemSelect={() => {}}
      />
      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        <div className="min-h-screen bg-gray-50 px-6 py-10">
          <UnansweredIssuesTab />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
