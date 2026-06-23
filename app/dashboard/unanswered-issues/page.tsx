import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import UnansweredIssuesTab from "@/features/dashboard/shared/unanswered-issues.tab";

export default async function UnansweredIssuesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role === "CONTRIBUTOR" || role === "TEAM_MEMBER") {
    redirect("/dashboard/overview");
  }

  return <UnansweredIssuesTab />;
}
