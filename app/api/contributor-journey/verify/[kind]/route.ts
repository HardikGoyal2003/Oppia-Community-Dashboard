import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { JOURNEY_VERIFICATION_KINDS } from "@/lib/domain/contributor-journey.types";
import type { JourneyVerificationKind } from "@/lib/domain/contributor-journey.types";
import { verifyContributorJourneyMilestoneByUid } from "@/lib/contributor-journey/contributor-journey-verification.service";
import { GitHubRestError } from "@/lib/github/github.rest";
import {
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/db/db.errors";

type VerificationRequestBody = {
  url: string;
};

type AuthorizedJourneyContext =
  | {
      platform: ContributionPlatform;
      response: null;
      userId: string;
      githubUsername: string;
    }
  | {
      platform: null;
      response: NextResponse<{ error: string }>;
      userId: null;
      githubUsername?: never;
    };

function getAuthorizedPlatform(
  session: Session | null,
): AuthorizedJourneyContext {
  if (!session?.user?.id || session.invalidUser) {
    return {
      platform: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
      userId: null,
    };
  }

  if (!session.user.platform) {
    return {
      platform: null,
      response: NextResponse.json(
        { error: "No contribution platform found for the current user." },
        { status: 400 },
      ),
      userId: null,
    };
  }

  return {
    platform: session.user.platform,
    response: null,
    userId: session.user.id,
    githubUsername: session.user.githubUsername,
  };
}

function parseVerificationKind(value: string): JourneyVerificationKind | null {
  return JOURNEY_VERIFICATION_KINDS.includes(value as JourneyVerificationKind)
    ? (value as JourneyVerificationKind)
    : null;
}

/**
 * Verifies and persists one contributor journey milestone proof URL.
 *
 * @param kind The stable verification kind (first-issue-claim, first-pr-merge, or second-pr-merge).
 * @param req The incoming request with proof URL.
 * @returns The verification result.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await getServerSession(authOptions);
  const { response, platform, userId, githubUsername } =
    getAuthorizedPlatform(session);

  if (response) {
    return response;
  }

  const { kind } = await params;
  const parsedKind = parseVerificationKind(kind);

  if (!parsedKind) {
    return NextResponse.json(
      { error: "Invalid verification kind." },
      { status: 400 },
    );
  }

  const body = (await req
    .json()
    .catch(() => null)) as VerificationRequestBody | null;

  if (!body?.url) {
    return NextResponse.json(
      { error: "Verification URL is required." },
      { status: 400 },
    );
  }

  const url = body.url.trim();

  try {
    const verification = await verifyContributorJourneyMilestoneByUid(
      userId,
      platform,
      parsedKind,
      url,
      githubUsername,
    );

    return NextResponse.json(verification);
  } catch (error) {
    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof DbInvalidStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof DbNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof GitHubRestError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }

    throw error;
  }
}
