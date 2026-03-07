import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";

import TeamLeadView from "./views/team-lead.view";
import ContributorView from "./views/contributor.view";
import TeamMemberView from "./views/team-member.view";
import TechLeadView from "./views/tech-lead.view";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const { role } = session.user;

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
