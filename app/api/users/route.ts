import { NextResponse } from "next/server";
import { getAllUsers, updateUserRole } from "@/lib/db/users.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await getAllUsers();
  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { uid, role } = await req.json();
  await updateUserRole(uid, role);

  return NextResponse.json({ success: true });
}
