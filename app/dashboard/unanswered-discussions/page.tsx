import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import UnansweredDiscussionsTab from "@/features/dashboard/shared/unanswered-discussions.tab";

export default async function UnansweredDiscussionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { role, platform } = session.user;

  if (platform === null) {
    redirect("/dashboard");
  }

  if (role === "CONTRIBUTOR") {
    redirect("/dashboard/overview");
  }

  return <UnansweredDiscussionsTab />;
}
