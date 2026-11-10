import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import TeamLeadOverviewTab from "@/features/dashboard/views/team-lead-view/tabs/overview.tab";
import { AdminOverviewTab } from "@/features/dashboard/views/tech-lead-view/tabs/overview.tab";
import { TeamMemberOverviewTab } from "@/features/dashboard/views/team-member-view/tabs/overview.tab";
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

  if (role === "ALUMNI") {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="max-w-xl rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold">
            Thank you for your contributions!
          </h1>
          <p className="text-gray-600">
            Your account has been moved to Alumni status. If you believe this is
            a mistake, please reach out to an admin.
          </p>
        </div>
      </div>
    );
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return <AdminOverviewTab />;
  }

  if (role === "TEAM_LEAD" || role === "LEAD_TRAINEE") {
    return <TeamLeadOverviewTab />;
  }

  if (role === "TEAM_MEMBER") {
    return <TeamMemberOverviewTab platform={platform} />;
  }

  return <ContributorOverviewWrapper platform={platform} />;
}
