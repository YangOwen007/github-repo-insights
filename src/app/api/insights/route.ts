import { NextRequest, NextResponse } from "next/server";
import { getRepoInsights, InsightsError } from "@/lib/github";
import { acquireRequestBudget } from "@/lib/request-budget";

export const runtime = "nodejs";

// This route keeps GitHub fetching on the server so the UI only deals with one clean app-level contract.
export async function GET(request: NextRequest) {
  const repoParam = request.nextUrl.searchParams.get("repo");

  if (!repoParam) {
    return NextResponse.json(
      {
        error: "Add a repo query, like /api/insights?repo=vercel/next.js.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const release = acquireRequestBudget();
  if (!release) return NextResponse.json({ error: "Too many reports requested. Please try again in a minute." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  try {
    const insights = await getRepoInsights(repoParam);

    return NextResponse.json(insights, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Never expose raw validation details, upstream payloads, or credentials to clients.
    const message = error instanceof InsightsError ? error.message : "GitHub returned unexpected data. Please try again later.";
    const status = error instanceof InsightsError ? error.status : 502;

    return NextResponse.json(
      {
        error: message,
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    release();
  }
}
