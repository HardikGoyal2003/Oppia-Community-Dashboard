import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { authOptions } from "@/lib/auth/auth.options";
import {
  JOURNEY_VERIFICATION_KINDS,
  type JourneyVerificationKind,
} from "@/lib/domain/contributor-journey.types";
import { verifyContributorJourneyMilestoneByUid } from "@/lib/contributor-journey/contributor-journey-verification.service";
import { GitHubRestError } from "@/lib/github/github.rest";
import {
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/db/db.errors";

type VerificationRequestBody = {
  url?: string;
};

type AuthorizedJourneyContext =
  | {
      platform: ContributionPlatform;
      response: null;
      userId: string;
    }
  | {
      platform: null;
      response: NextResponse<{ error: string }>;
      userId: null;
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
 * @param req The incoming verification request carrying the GitHub URL.
 * @param context The dynamic route params with the verification kind.
 * @returns The verification result plus the updated roadmap snapshot.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const session = await getServerSession(authOptions);
  const { response, platform, userId } = getAuthorizedPlatform(session);

  if (response) {
    return response;
  }

  const { kind: rawKind } = await context.params;
  const kind = parseVerificationKind(rawKind);

  if (!kind) {
    return NextResponse.json(
      { error: "Invalid contributor journey verification kind." },
      { status: 400 },
    );
  }

  const body = (await req
    .json()
    .catch(() => null)) as VerificationRequestBody | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json(
      { error: "Verification URL is required." },
      { status: 400 },
    );
  }

  try {
    const verification = await verifyContributorJourneyMilestoneByUid(
      userId,
      platform,
      kind,
      url,
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
