import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getMemberAccessRequests } from "@/lib/db/member-request-access.service";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const requests = await getMemberAccessRequests();
  return NextResponse.json(requests);
}
