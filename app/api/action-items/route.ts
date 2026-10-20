import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  compareActionItemsForDisplay,
  syncActionItems,
} from "@/lib/action-items/action-items.service";
import {
  getActionItems,
  getActionItemsByTeamKey,
} from "@/db/action-items/action-items.db";

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
      { error: "Your team assignment is incomplete." },
      { status: 400 },
    );
  }

  try {
    const syncSummary = await syncActionItems();
    let items: Awaited<ReturnType<typeof getActionItems>>;

    if (isLead) {
      // Leads only need their own team's items; the query stays indexed.
      items = await getActionItemsByTeamKey(team!);
    } else {
      items = await getActionItems();

      const teamFilter = new URL(req.url).searchParams.get("team");

      if (teamFilter) {
        items = items.filter((item) => item.teamKey === teamFilter);
      }
    }

    items.sort(compareActionItemsForDisplay);

    return NextResponse.json({
      items,
      sync: syncSummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load action items.",
      },
      { status: 500 },
    );
  }
}
