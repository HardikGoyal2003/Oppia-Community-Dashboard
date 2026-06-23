import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import MyContributionJourneyTab from "@/features/dashboard/views/contributor-view/components/my-contribution-journey.tab";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

export default async function MyContributionJourneyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    redirect("/dashboard/incoming-requests");
  }

  if (role !== "CONTRIBUTOR") {
    redirect("/dashboard/overview");
  }

  return (
    <MyContributionJourneyTab platform={platform as ContributionPlatform} />
  );
}
