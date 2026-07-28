import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { role } = session.user;
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can seed ChromaDB" },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as {
      maxIssues?: number;
      githubToken?: string;
    };

    // Trigger the Python seed script via the backend
    const res = await fetch(`${TRIAGE_BACKEND}/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_issues: body.maxIssues || 10000,
        github_token: body.githubToken,
      }),
      signal: AbortSignal.timeout(600000), // 10 min timeout for large seeds
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Seed failed: ${text}` },
        { status: 500 },
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Seed ChromaDB error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}
