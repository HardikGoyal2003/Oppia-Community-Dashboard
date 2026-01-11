import { getServerSession } from "next-auth";
import { authOptions } from "./auth.options";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  return session;
}
