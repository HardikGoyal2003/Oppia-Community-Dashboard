"use client";

import { CONTRIBUTING_DOCS } from "@/lib/config";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import MemberRequestAccessModal from "./member-request-access-modal";

export default function ContributorOverviewTab({
  message,
  onStartRoadmap,
  platform,
}: {
  message: string;
  onStartRoadmap: () => void;
  platform: ContributionPlatform;
}) {
  const docsUrl = CONTRIBUTING_DOCS[platform];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl rounded-lg border bg-white p-8 text-center shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Welcome to Oppia Community Dashboard 👋
        </h1>
        <p className="mb-6 text-gray-600">{message}</p>

        <div className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            Get started as a contributor
          </h2>
          <p className="mb-4 text-gray-500">
            Use the curated roadmap to go step by step from onboarding to your
            first contribution.
          </p>
          <button
            type="button"
            onClick={onStartRoadmap}
            className="cursor-pointer inline-block rounded-md bg-blue-600 px-5 py-2 font-medium text-white transition hover:bg-blue-700"
          >
            Start Contribution Roadmap
          </button>
          <p className="mt-3 text-sm text-gray-500">
            Prefer reading first?{" "}
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              View Oppia Contributing Docs
            </a>
          </p>
        </div>

        <div className="mb-4 border-t pt-6">
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            Are you an Oppia member or collaborator?
          </h2>
          <p className="mb-4 text-gray-500">
            Request access to a team by filling out the form below:
          </p>
          <MemberRequestAccessModal platform={platform} />
        </div>
      </div>

      <p className="mt-8 max-w-md text-center text-sm text-gray-400">
        Once your request is approved, you&apos;ll be able to see your team
        dashboard and start contributing.
      </p>
    </div>
  );
}
