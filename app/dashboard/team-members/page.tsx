import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { TeamMembersTab } from "@/features/dashboard/views/team-lead-view/tabs/team-members.tab";

export default async function TeamMembersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role !== "TEAM_LEAD" && role !== "LEAD_TRAINEE") {
    redirect("/dashboard/overview");
  }

  return <TeamMembersTab />;
}
