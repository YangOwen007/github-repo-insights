import { NextResponse } from "next/server";

// Liveness is independent of GitHub availability and reveals no environment values.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
