import type { ContributionPlatform } from "@/lib/auth/auth.types";

export const DERIVED_JOURNEY_KEYS = [
  "FIRST_ISSUE_CLAIMED",
  "FIRST_PR_MERGED",
  "SECOND_PR_MERGED",
] as const;

export type DerivedJourneyKey = (typeof DERIVED_JOURNEY_KEYS)[number];

export type JourneyCompletionType = "manual" | "verification";

export const JOURNEY_VERIFICATION_KINDS = [
  "first-issue-claim",
  "first-pr-merge",
  "second-pr-merge",
] as const;

export type JourneyVerificationKind =
  (typeof JOURNEY_VERIFICATION_KINDS)[number];

export type ManualProgressState = {
  completed: boolean;
  completedAt: Date | null;
};

export type DerivedProgressState = {
  completed: boolean;
  completedAt: Date | null;
  sourceUrl: string | null;
};

export type UserJourneyProgressModel = {
  createdAt: Date;
  derivedState: Record<DerivedJourneyKey, DerivedProgressState>;
  manualProgress: Record<string, ManualProgressState>;
  platform: ContributionPlatform | null;
  updatedAt: Date;
};

export type JourneyProgressSnapshot = {
  createdAt: string;
  derivedState: Record<
    DerivedJourneyKey,
    {
      completed: boolean;
      completedAt: string | null;
      sourceUrl: string | null;
    }
  >;
  manualProgress: Record<
    string,
    {
      completed: boolean;
      completedAt: string | null;
    }
  >;
  platform: ContributionPlatform | null;
  updatedAt: string;
};

export type JourneyVerificationResult = {
  derivedKey: DerivedJourneyKey;
  message: string;
  sourceUrl: string;
  verified: boolean;
};
