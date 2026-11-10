"use client";

import { useRouter } from "next/navigation";
import ContributorOverviewTab from "@/features/dashboard/views/contributor-view/components/contributor-overview.tab";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

export default function ContributorOverviewWrapper({
  platform,
}: {
  platform: ContributionPlatform | null;
}) {
  const router = useRouter();

  return (
    <ContributorOverviewTab
      message="Thanks for signing up! You'll get access once you're assigned to a team."
      onStartRoadmap={() => router.push("/dashboard/my-contribution-journey")}
      platform={platform ?? "WEB"}
    />
  );
}
