import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { authOptions } from "@/lib/auth/auth.options";
import { ControlPanelTabs } from "@/features/control-panel/components/control-panel-tabs";

export default async function ControlPanelPage() {
  const session = await getServerSession(authOptions);
  const showCronJobs = process.env.NODE_ENV === "development";

  if (!session || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Super Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Control Panel
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            This page is reserved for operational controls that must never be
            exposed through normal role workflows. Super admin access must be
            assigned directly in the database.
          </p>
        </div>

        <ControlPanelTabs showCronJobs={showCronJobs} />
      </main>
    </div>
  );
}
