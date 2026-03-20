import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getNotificationsByEmail,
  markNotificationAsReadByEmail,
} from "@/db/users.db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
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

  const notifications = await getNotificationsByEmail(
    session.user.email,
    status
  );

  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const notificationId =
    typeof body.notificationId === "string"
      ? body.notificationId.trim()
      : "";

  if (!notificationId) {
    return NextResponse.json(
      { error: "Invalid notification id." },
      { status: 400 }
    );
  }

  await markNotificationAsReadByEmail(
    session.user.email,
    notificationId
  );

  return NextResponse.json({ success: true });
}
