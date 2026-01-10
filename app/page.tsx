"use client";

import { signIn } from "next-auth/react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">
          Oppia Leads Dashboard
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A centralized dashboard for Oppia team and area leads to track
          unresolved GitHub issues where the last response is from a
          non-maintainer — so nothing slips through the cracks.
        </p>

        <button
          onClick={() => signIn("google")}
          className="mt-8 rounded-md bg-primary px-6 py-3 text-white hover:opacity-90"
        >
          Sign in with Google
        </button>
      </section>

      {/* Problem */}
      <section className="bg-muted px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold">
            Why this dashboard exists
          </h2>

          <p className="mt-4 text-muted-foreground">
            Oppia receives a large number of GitHub issues and pull requests.
            Sometimes, contributors respond — but maintainers don’t follow up
            in time. This dashboard highlights those cases so leads can act
            quickly.
          </p>
        </div>
      </section>

      {/* Roles */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold">
            Built for every role in Oppia
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <RoleCard
              title="Contributor"
              description="View general status and updates. More features coming soon."
            />
            <RoleCard
              title="Team Member"
              description="Track team-related issues and stay aligned with progress."
            />
            <RoleCard
              title="Team Lead"
              description="Monitor issues for your team and ensure timely responses."
            />
            <RoleCard
              title="Area Lead"
              description="Manage roles, oversee teams, and ensure accountability across areas."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold">
            How it works
          </h2>

          <ol className="mt-8 space-y-4 text-muted-foreground">
            <li>1. Sign in using your Google account</li>
            <li>2. Your role determines what you can see</li>
            <li>3. Leads get actionable issue insights</li>
            <li>4. Area leads manage access and roles</li>
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold">
          Ready to get started?
        </h2>

        <p className="mt-4 text-muted-foreground">
          Sign in with Google and access the dashboard based on your role.
        </p>

        <button
          onClick={() => signIn("google")}
          className="mt-6 rounded-md bg-primary px-6 py-3 text-white hover:opacity-90"
        >
          Sign in with Google
        </button>
      </section>
    </main>
  );
}

function RoleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border p-6 shadow-sm">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}
