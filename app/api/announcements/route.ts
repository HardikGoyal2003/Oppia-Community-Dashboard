import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getAnnouncementBanner,
  upsertAnnouncementBanner,
} from "@/db/announcements/announcements.db";
import { DbNotFoundError } from "@/db/db.errors";

function isSuperAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export async function GET() {
  try {
    const banner = await getAnnouncementBanner();

    return NextResponse.json({
      announcement: {
        ...banner,
        updatedAt: banner.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof DbNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    throw error;
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const isEnabled = Boolean(body.isEnabled);

  await upsertAnnouncementBanner({
    title,
    message,
    isEnabled,
  });

  return NextResponse.json({ success: true });
}
