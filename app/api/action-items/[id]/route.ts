import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DbNotFoundError } from "@/db/db.errors";
import { authOptions } from "@/lib/auth/auth.options";
import {
  canReviewActionItem,
  getActionItem,
  updateActionItemStatus,
} from "@/lib/action-items/action-items.service";
import type { ActionItemReviewStatus } from "@/lib/domain/action-items.types";

const REVIEW_STATUSES: readonly ActionItemReviewStatus[] = [
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
];

type ActionItemPatchBody = {
  status?: string | null;
  note?: string | null;
};

/**
 * Applies a review transition (acknowledge / resolve / dismiss) to one action
 * item. Leads may act on their own team's items; admins may override anywhere.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  let body: ActionItemPatchBody;

  try {
    body = (await req.json()) as ActionItemPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body.status !== "string" ||
    !REVIEW_STATUSES.includes(body.status as ActionItemReviewStatus)
  ) {
    return NextResponse.json(
      {
        error: "status must be one of ACKNOWLEDGED, RESOLVED, or DISMISSED.",
      },
      { status: 400 },
    );
  }

  if (
    body.note !== undefined &&
    body.note !== null &&
    typeof body.note !== "string"
  ) {
    return NextResponse.json(
      { error: "note must be a string." },
      { status: 400 },
    );
  }

  try {
    const item = await getActionItem(id);

    if (!item) {
      return NextResponse.json(
        { error: "Action item not found." },
        { status: 404 },
      );
    }

    if (!canReviewActionItem(item, session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedItem = await updateActionItemStatus(
      id,
      body.status as ActionItemReviewStatus,
      session.user.id,
      typeof body.note === "string" ? body.note : null,
    );

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    if (error instanceof DbNotFoundError) {
      return NextResponse.json(
        { error: "Action item not found." },
        { status: 404 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update action item.",
      },
      { status: 500 },
    );
  }
}
