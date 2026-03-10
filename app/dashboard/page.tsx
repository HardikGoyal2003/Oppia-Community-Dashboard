import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";

import TeamLeadView from "../../features/dashboard/views/team-lead-view/team-lead.view";
import ContributorView from "../../features/dashboard/views/contributor-view/contributor.view";
import TeamMemberView from "../../features/dashboard/views/team-member-view/team-member.view";
import TechLeadView from "../../features/dashboard/views/tech-lead-view/tech-lead.view";
import { PlatformSelectModal } from "@/features/login-flow/platform-select-modal";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const { role } = session.user;
  const platform = session.user.platform ?? null;

  // Do not render any dashboard content until the user selects a platform.
  if (platform === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PlatformSelectModal initialPlatform={platform} />
      </div>
    );
  }

  if (role === "ADMIN") {
    return <TechLeadView />;
  }

  switch (role) {
    case "TEAM_LEAD":
      return (
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <TeamLeadView />
        </div>
      );

    case "TEAM_MEMBER":
      return (
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <TeamMemberView />
        </div>
      );

    default:
      return (
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <ContributorView />
        </div>
      );
  }
}
