import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const { role } = session.user;

  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      redirect("/dashboard/incoming-requests");
    case "TEAM_LEAD":
      redirect("/dashboard/overview");
    case "LEAD_TRAINEE":
    case "TEAM_MEMBER":
      redirect("/dashboard/overview");
    default:
      redirect("/dashboard/overview");
  }
}
