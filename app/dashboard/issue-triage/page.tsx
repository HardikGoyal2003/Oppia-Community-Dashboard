import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { IssueTriageDashboard } from "@/features/dashboard/shared/issue-triage/components/issue-triage-dashboard";

export default async function IssueTriagePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    redirect("/dashboard/overview");
  }

  return <IssueTriageDashboard />;
}
