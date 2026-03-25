"use client";

import { CONTRIBUTING_DOCS } from "@/lib/config/github.constants";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import MemberRequestAccessModal from "./components/member-request-access-modal";

export default function ContributorView({
  message = "Thanks for signing up! You’ll get access once you’re assigned to a team.",
  platform,
}: {
  message?: string;
  platform: ContributionPlatform;
}) {
  const docsUrl = CONTRIBUTING_DOCS[platform];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Welcome Card */}
      <div className="max-w-2xl w-full rounded-lg border bg-white p-8 shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Oppia Community Dashboard 👋
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>

        {/* Info Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Get started as a contributor
          </h2>
          <p className="text-gray-500 mb-4">
            Check out the{" "}
            <span className="font-medium">Oppia Contributing Docs</span> to
            learn how to contribute.
          </p>
          <a
            href={docsUrl}
            target="_blank"
            className="inline-block rounded-md bg-blue-600 px-5 py-2 text-white font-medium hover:bg-blue-700 transition"
          >
            View Docs
          </a>
        </div>

        {/* Action Section */}
        <div className="mb-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Are you an Oppia member or collaborator?
          </h2>
          <p className="text-gray-500 mb-4">
            Request access to a team by filling out the form below:
          </p>
          <MemberRequestAccessModal platform={platform} />
        </div>
      </div>

      {/* footer tips */}
      <p className="mt-8 text-gray-400 text-sm text-center max-w-md">
        Once your request is approved, you&apos;ll be able to see your team
        dashboard and start contributing.
      </p>
    </div>
  );
}
