import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  getContributorJourneySnapshotByUid,
  markContributorJourneyManualItemCompletedByUid,
} from "@/lib/contributor-journey/contributor-journey.service";
import {
  DbInvalidStateError,
  DbNotFoundError,
  DbValidationError,
} from "@/db/db.errors";

type ContributorJourneyPatchBody = {
  itemId: string;
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

/**
 * Returns the persisted contributor journey progress merged with roadmap config.
 *
 * @returns The current contributor journey snapshot for the signed-in user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const { response, platform, userId } = getAuthorizedPlatform(session);

  if (response) {
    return response;
  }

  const snapshot = await getContributorJourneySnapshotByUid(userId, platform);
  return NextResponse.json(snapshot);
}

/**
 * Marks one manual contributor journey item as completed. Completion is one-way.
 *
 * @param req The incoming request carrying a stable item id.
 * @returns The updated contributor journey snapshot.
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const { response, platform, userId } = getAuthorizedPlatform(session);

  if (response) {
    return response;
  }

  const body = (await req
    .json()
    .catch(() => null)) as ContributorJourneyPatchBody | null;

  if (!body?.itemId) {
    return NextResponse.json({ error: "Invalid itemId." }, { status: 400 });
  }

  const itemId = body.itemId.trim();

  try {
    const progress = await markContributorJourneyManualItemCompletedByUid(
      userId,
      platform,
      itemId,
    );
    const snapshot = await getContributorJourneySnapshotByUid(
      userId,
      platform,
      progress,
    );
    return NextResponse.json(snapshot);
  } catch (err) {
    if (err instanceof DbValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err instanceof DbInvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    if (err instanceof DbNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    throw err;
  }
}
