import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import { ReviewerReportsTab } from "@/features/dashboard/views/tech-lead-view/tabs/reviewer-teams.tab";

export default async function ReviewerTeamsPage() {
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

  return <ReviewerReportsTab />;
}
