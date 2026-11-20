import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/auth.options";
import { MyReviewerReportsTab } from "@/features/dashboard/shared/my-reviewer-reports/components/my-reviewer-reports.tab";

export default async function MyReviewerReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.platform === null) {
    redirect("/dashboard");
  }

  return <MyReviewerReportsTab />;
}
