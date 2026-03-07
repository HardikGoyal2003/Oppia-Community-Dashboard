import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";

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

  switch (role) {
    case "TEAM_LEAD":
      return <TeamLeadView />;

    case "ADMIN":
      return <TechLeadView />;

    case "TEAM_MEMBER":
      return <TeamMemberView />;

    default:
      return <ContributorView />;
  }
}
