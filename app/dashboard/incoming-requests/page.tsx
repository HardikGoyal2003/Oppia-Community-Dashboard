import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { IncomingRequestTab } from "@/features/dashboard/views/tech-lead-view/tabs/incoming-request.tab";
import { TeamIncomingRequestsTab } from "@/features/dashboard/views/team-lead-view/tabs/incoming-requests.tab";

export default async function IncomingRequestsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return <IncomingRequestTab />;
  }

  if (role === "TEAM_LEAD" || role === "LEAD_TRAINEE") {
    return <TeamIncomingRequestsTab />;
  }

  redirect("/dashboard/overview");
}
