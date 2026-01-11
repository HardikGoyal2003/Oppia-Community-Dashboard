"use client";

import { signIn } from "next-auth/react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        {/* Oppia-style gradient glow */}
        <div className="absolute -top-40 left-1/2 h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-linear-to-tr from-emerald-400/40 via-teal-400/30 to-cyan-400/40 blur-[150px]" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-20 px-6 py-32 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <span className="inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-sm font-medium text-emerald-600">
              Open-source engineering dashboard
            </span>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
              Keep Oppia’s engineering
              <span className="block bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                moving forward
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A centralized dashboard for team and tech leads to surface stalled
              issues, missed follow-ups, and accountability gaps — before they
              slow the project down.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-8 py-4 text-sm font-semibold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                Sign in with Google →
              </button>

              <span className="text-sm text-muted-foreground">
                Role-based access • No setup
              </span>
            </div>
          </div>

          {/* Right – dashboard preview */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-background/70 backdrop-blur-xl p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-sm font-medium">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live issue insights
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between rounded-md bg-emerald-500/10 px-3 py-2">
                  <span>Unresponded issues</span>
                  <span className="font-semibold text-emerald-600">12</span>
                </div>
                <div className="flex justify-between rounded-md bg-teal-500/10 px-3 py-2">
                  <span>Pending PR reviews</span>
                  <span className="font-semibold text-teal-600">7</span>
                </div>
                <div className="flex justify-between rounded-md bg-cyan-500/10 px-3 py-2">
                  <span>Teams at risk</span>
                  <span className="font-semibold text-cyan-600">3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHY ================= */}
      <section className="bg-muted/40 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The problem isn’t contributors.
              <span className="block text-emerald-600">
                It’s visibility.
              </span>
            </h2>

            <p className="mt-6 text-lg text-muted-foreground">
              Oppia thrives on open source — but scale without visibility leads
              to missed follow-ups, stalled PRs, and unclear ownership.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <ProblemCard
              color="emerald"
              icon="⏱️"
              title="Missed follow-ups"
              description="Contributor responses get buried across issues and PRs."
            />
            <ProblemCard
              color="teal"
              icon="❓"
              title="Unclear ownership"
              description="Issues float without a clear team or lead accountable."
            />
            <ProblemCard
              color="cyan"
              icon="📉"
              title="Late intervention"
              description="Problems surface only after momentum is already lost."
            />
          </div>
        </div>
      </section>

      {/* ================= ROLES ================= */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Designed for every level
              <span className="block text-emerald-600">
                of responsibility
              </span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <RoleCard icon="🧑‍💻" title="Contributor" description="Stay informed and aligned with issue progress." />
            <RoleCard icon="👥" title="Team Member" description="Track team issues and prevent silent stalls." />
            <RoleCard icon="🧭" title="Team Lead" description="Identify problems early and keep momentum high." />
            <RoleCard icon="⚙️" title="Tech Lead" description="Oversee teams, roles, and accountability at scale." />
          </div>
        </div>
      </section>

      {/* ================= HOW ================= */}
      <section className="bg-muted/40 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple to use.
              <span className="block text-emerald-600">
                Powerful by design.
              </span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <StepCard step="01" title="Sign in" description="Authenticate using Google." />
            <StepCard step="02" title="Auto role detection" description="Access is based on your Oppia role." />
            <StepCard step="03" title="Actionable insights" description="Surface stalled issues instantly." />
            <StepCard step="04" title="Lead action" description="Intervene before problems escalate." />
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden px-6 py-32">
        <div className="absolute inset-0 -z-10 bg-linear-to-tr from-emerald-500/30 via-teal-500/30 to-cyan-500/30" />

        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Visibility creates
            <span className="block text-emerald-600">
              better open source
            </span>
          </h2>

          <p className="mt-6 text-lg text-muted-foreground">
            Help Oppia scale responsibly with clarity, ownership, and momentum.
          </p>

          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-8 py-4 text-sm font-semibold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Sign in with Google →
          </button>
        </div>
      </section>
    </main>
  );
}

/* ================= COMPONENTS ================= */

function RoleCard({ icon, title, description }: any) {
  return (
    <div className="group relative rounded-xl border bg-background p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="absolute inset-0 rounded-xl bg-linear-to-br from-emerald-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 text-3xl">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ProblemCard({ icon, title, description, color }: any) {
  const colors: any = {
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-600",
    teal: "from-teal-500/20 to-teal-500/5 text-teal-600",
    cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-600",
  };

  return (
    <div className="rounded-xl border bg-background p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-linear-to-br ${colors[color]}`}>
        <span className="text-xl">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: any) {
  return (
    <div className="relative rounded-xl border bg-background p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <span className="absolute -top-3 left-6 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-3 py-1 text-xs font-semibold text-white">
        {step}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
