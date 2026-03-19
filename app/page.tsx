import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

type RoleCardProps = {
  icon: string;
  title: string;
  description: string;
};

type JourneyCardProps = {
  step: string;
  title: string;
  description: string;
};

type ImpactCardProps = {
  icon: string;
  title: string;
  description: string;
};

const ROLE_CARDS: RoleCardProps[] = [
  {
    icon: "🌱",
    title: "New Contributors",
    description:
      "Get a structured path to onboard, pick the right team, and contribute with confidence.",
  },
  {
    icon: "🤝",
    title: "Team Members",
    description:
      "Track issue flow, unblock contributors quickly, and keep delivery momentum healthy.",
  },
  {
    icon: "🧭",
    title: "Team Leads",
    description:
      "Coordinate priorities, monitor progress, and intervene before work gets stuck.",
  },
  {
    icon: "📈",
    title: "Maintainers & Admins",
    description:
      "Manage roles, requests, and community health while scaling contribution quality.",
  },
];

const JOURNEY_CARDS: JourneyCardProps[] = [
  {
    step: "01",
    title: "Sign in",
    description: "Join with your GitHub account and enter a role-based workspace.",
  },
  {
    step: "02",
    title: "Choose your path",
    description: "Request team access and get mapped to a clear contribution journey.",
  },
  {
    step: "03",
    title: "Contribute with guidance",
    description: "Work on issues with visibility, ownership, and timely follow-ups.",
  },
  {
    step: "04",
    title: "Grow with the community",
    description: "Maintainers can mentor, review progress, and keep everyone aligned.",
  },
];

const IMPACT_CARDS: ImpactCardProps[] = [
  {
    icon: "🧩",
    title: "Structured onboarding",
    description:
      "New contributors are guided into teams instead of getting lost in open issues.",
  },
  {
    icon: "⚡",
    title: "Faster coordination",
    description:
      "Team and tech leads can resolve requests, manage roles, and unblock work quickly.",
  },
  {
    icon: "💬",
    title: "Healthy community loop",
    description:
      "Notifications and visibility keep contributors informed, motivated, and active.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden">
        <div className="absolute -top-44 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-linear-to-tr from-emerald-400/40 via-teal-400/30 to-cyan-400/40 blur-[160px]" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-28 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-sm font-medium text-emerald-700">
              Built for contributors and maintainers
            </span>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
              One dashboard for
              <span className="block bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                every role in Oppia
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              What started for maintainers now scales to everyone. New contributors get a clear contribution path, while leads and admins can keep teams active, track progress, and support the community at scale.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-8 py-4 text-sm font-semibold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                Enter Dashboard →
              </Link>

              <span className="text-sm text-muted-foreground">
                Inclusive workflow • Role-based experience
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/70 p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Community Snapshot
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-md bg-emerald-500/10 px-3 py-2">
                <span>New access requests</span>
                <span className="font-semibold text-emerald-700">Live</span>
              </div>
              <div className="flex justify-between rounded-md bg-teal-500/10 px-3 py-2">
                <span>Unanswered issues</span>
                <span className="font-semibold text-teal-700">Tracked</span>
              </div>
              <div className="flex justify-between rounded-md bg-cyan-500/10 px-3 py-2">
                <span>Role and team updates</span>
                <span className="font-semibold text-cyan-700">Managed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A dashboard that scales with
              <span className="block text-emerald-700">the whole community</span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_CARDS.map(card => (
              <RoleCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Structured from first contribution
              <span className="block text-emerald-700">to long-term leadership</span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY_CARDS.map(card => (
              <JourneyCard
                key={card.step}
                step={card.step}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why this matters now
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {IMPACT_CARDS.map(card => (
              <ImpactCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute inset-0 -z-10 bg-linear-to-tr from-emerald-500/25 via-teal-500/25 to-cyan-500/25" />

        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Grow contributions.
            <span className="block text-emerald-700">
              Keep Oppia community momentum high.
            </span>
          </h2>

          <p className="mt-6 text-lg text-muted-foreground">
            Start with the role you have today and progress with a system designed to support every contributor and maintainer.
          </p>

          <Link
            href="/login"
            className="cursor-pointer mt-10 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-8 py-4 text-sm font-semibold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Sign in with GitHub →
          </Link>
        </div>
      </section>

      <SiteFooter className="border-t px-6 py-6 text-center text-sm text-muted-foreground" />
    </main>
  );
}

function RoleCard({ icon, title, description }: RoleCardProps) {
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

function JourneyCard({ step, title, description }: JourneyCardProps) {
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

function ImpactCard({ icon, title, description }: ImpactCardProps) {
  return (
    <div className="rounded-xl border bg-background p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500/20 to-emerald-500/5 text-xl text-emerald-700">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
