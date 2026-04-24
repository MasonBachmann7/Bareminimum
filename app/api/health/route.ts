import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap liveness probe for Render's health check. Intentionally does not
 * touch the database — a DB outage should not flap the web service offline,
 * because serving the landing page is still useful while we recover.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "bareminimum" });
}
