import { NextRequest, NextResponse } from "next/server";
import { getRepoInsights } from "@/lib/github";
import { normalizeRepoInput } from "@/lib/github";

// This route keeps GitHub fetching on the server so the UI only deals with one clean app-level contract.
export async function GET(request: NextRequest) {
  const repoParam = request.nextUrl.searchParams.get("repo");

  if (!repoParam) {
    return NextResponse.json(
      {
        error: "Add a repo query, like /api/insights?repo=vercel/next.js.",
      },
      { status: 400 },
    );
  }

  try {
    normalizeRepoInput(repoParam);
    const insights = await getRepoInsights(repoParam);

    return NextResponse.json(insights);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while fetching repository insights.";

    const status = message.includes("not found")
      ? 404
      : message.includes("rate limit")
        ? 429
        : 400;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
