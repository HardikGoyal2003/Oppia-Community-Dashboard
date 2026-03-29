"use client";

import { useState } from "react";
import { LayoutDashboard, Map } from "lucide-react";
import { CONTRIBUTING_DOCS } from "@/lib/config";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { Navbar } from "@/components/layout/navbar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import MemberRequestAccessModal from "./components/member-request-access-modal";
import MyContributionJourneyTab from "./components/my-contribution-journey.tab";

type ContributorSidebarTab = "OVERVIEW" | "MY_CONTRIBUTION_JOURNEY";

export default function ContributorView({
  message = "Thanks for signing up! You’ll get access once you’re assigned to a team.",
  platform,
}: {
  message?: string;
  platform: ContributionPlatform;
}) {
  const docsUrl = CONTRIBUTING_DOCS[platform];
  const [activeTab, setActiveTab] = useState<ContributorSidebarTab>("OVERVIEW");
  const sidebarItems = [
    {
      name: "Overview",
      icon: LayoutDashboard,
    },
    {
      name: "My Contribution Journey",
      icon: Map,
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        items={sidebarItems}
        activeItemName={
          activeTab === "MY_CONTRIBUTION_JOURNEY"
            ? "My Contribution Journey"
            : "Overview"
        }
        onItemSelect={(itemName) => {
          setActiveTab(
            itemName === "My Contribution Journey"
              ? "MY_CONTRIBUTION_JOURNEY"
              : "OVERVIEW",
          );
        }}
      />

      <SidebarInset>
        <Navbar leftContent={<SidebarTrigger className="-ml-1" />} />

        {activeTab === "OVERVIEW" ? (
          <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
            <div className="max-w-2xl w-full rounded-lg border bg-white p-8 shadow-md text-center">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">
                Welcome to Oppia Community Dashboard 👋
              </h1>
              <p className="mb-6 text-gray-600">{message}</p>

              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold text-gray-800">
                  Get started as a contributor
                </h2>
                <p className="mb-4 text-gray-500">
                  Check out the{" "}
                  <span className="font-medium">Oppia Contributing Docs</span>{" "}
                  to learn how to contribute.
                </p>
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-md bg-blue-600 px-5 py-2 font-medium text-white transition hover:bg-blue-700"
                >
                  View Docs
                </a>
              </div>

              <div className="mb-4 border-t pt-6">
                <h2 className="mb-2 text-lg font-semibold text-gray-800">
                  Are you an Oppia member or collaborator?
                </h2>
                <p className="mb-4 text-gray-500">
                  Request access to a team by filling out the form below:
                </p>
                <MemberRequestAccessModal platform={platform} />
              </div>
            </div>

            <p className="mt-8 max-w-md text-center text-sm text-gray-400">
              Once your request is approved, you&apos;ll be able to see your
              team dashboard and start contributing.
            </p>
          </div>
        ) : (
          <MyContributionJourneyTab platform={platform} />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
