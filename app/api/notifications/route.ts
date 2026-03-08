import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  getNotificationsByEmail,
  markNotificationAsReadByEmail,
} from "@/db/users.db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const notifications = await getNotificationsByEmail(
    session.user.email
  );

  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const notificationIndex =
    typeof body.notificationIndex === "number"
      ? body.notificationIndex
      : -1;

  if (!Number.isInteger(notificationIndex) || notificationIndex < 0) {
    return NextResponse.json(
      { error: "Invalid notification index." },
      { status: 400 }
    );
  }

  await markNotificationAsReadByEmail(
    session.user.email,
    notificationIndex
  );

  return NextResponse.json({ success: true });
}
