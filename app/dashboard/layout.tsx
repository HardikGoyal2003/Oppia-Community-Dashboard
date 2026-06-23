import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/auth/auth.types";
import { PlatformSelectModal } from "@/features/login-flow/platform-select-modal";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const { platform, role } = session.user;

  if (platform === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PlatformSelectModal initialPlatform={null} />
      </div>
    );
  }

  return <DashboardShell role={role as UserRole}>{children}</DashboardShell>;
}
