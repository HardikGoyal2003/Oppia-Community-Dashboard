import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getSyncedActionItems,
  getTeamIdForKey,
} from "@/lib/action-items/action-items.service";

function canManageOwnTeamActionItems(role: string): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

function canViewAllActionItems(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Returns the tracked action items for the caller's scope, syncing them from
 * the latest team reports first so the dashboard always reflects current data.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { role, team } = session.user;
  const isLead = canManageOwnTeamActionItems(role);
  const isAdmin = canViewAllActionItems(role);

  if (!isLead && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (isLead && !team) {
    return NextResponse.json(
      { error: "You are not assigned to any team." },
      { status: 400 },
    );
  }

  try {
    let teamId: string | null | undefined;

    if (isLead) {
      teamId = getTeamIdForKey(team!);
      if (!teamId) {
        return NextResponse.json({ error: "Unknown team." }, { status: 400 });
      }
    } else {
      const teamFilter = new URL(req.url).searchParams.get("team");
      if (teamFilter) {
        teamId = getTeamIdForKey(teamFilter);
        if (!teamId) {
          return NextResponse.json({ error: "Unknown team." }, { status: 400 });
        }
      }
    }

    const items = await getSyncedActionItems({ teamId });

    return NextResponse.json({
      items,
      count: items.length,
    });
  } catch (error) {
    console.error("Failed to fetch action items:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch action items.",
      },
      { status: 500 },
    );
  }
}
