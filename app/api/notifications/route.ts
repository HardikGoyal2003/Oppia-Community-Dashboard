import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getNotificationsByUid,
  markNotificationAsReadByUid,
} from "@/db/users/users.db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "read"
      ? "READ"
      : statusParam === "unread"
        ? "UNREAD"
        : "ALL";

  const notifications = await getNotificationsByUid(session.user.id, status);

  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const notificationId =
    typeof body.notificationId === "string" ? body.notificationId.trim() : "";

  if (!notificationId) {
    return NextResponse.json(
      { error: "Invalid notification id." },
      { status: 400 },
    );
  }

  await markNotificationAsReadByUid(session.user.id, notificationId);

  return NextResponse.json({ success: true });
}
