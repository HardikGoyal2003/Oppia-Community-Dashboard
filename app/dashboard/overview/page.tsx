import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import TeamLeadOverviewTab from "@/features/dashboard/views/team-lead-view/tabs/overview.tab";
import ContributorOverviewWrapper from "@/features/dashboard/views/contributor-view/components/contributor-overview-wrapper";

export default async function OverviewPage() {
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

  if (role === "TEAM_LEAD") {
    return <TeamLeadOverviewTab />;
  }

  if (role === "LEAD_TRAINEE" || role === "TEAM_MEMBER") {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="max-w-xl rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold">
            Team Dashboard Coming Soon 🚧
          </h1>
          <p className="text-gray-600">
            We&apos;re working on a dashboard tailored for team members. Stay
            tuned!
          </p>
        </div>
      </div>
    );
  }

  return <ContributorOverviewWrapper platform={platform} />;
}
