import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { authOptions } from "@/lib/auth/auth.options";

const PANEL_SECTIONS = [
  {
    title: "Data Migration Jobs",
    description:
      "Run controlled data migrations and track operational changes across collections.",
  },
  {
    title: "Announcement Banners",
    description:
      "Create and manage dashboard-wide announcement banners for users.",
  },
  {
    title: "Maintenance Mode",
    description:
      "Enable or disable maintenance mode while retaining super-admin bypass access.",
  },
  {
    title: "Feature Flags",
    description:
      "Control staged rollouts and environment-specific product behavior.",
  },
];

export default async function ControlPanelPage() {
  const session = await getServerSession(authOptions);

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
            This page is reserved for operational controls that must never be exposed through normal role workflows. Super admin access must be assigned directly in the database.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {PANEL_SECTIONS.map(section => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {section.description}
              </p>
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Configuration UI pending implementation.
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
