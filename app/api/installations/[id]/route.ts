import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  project_idea?: string | null;
  cadence_min?: number;
  cadence_max?: number;
  paused?: boolean;
};

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from installations where id = ${id} and user_id = ${userId} limit 1
  `) as unknown[];
  return rows.length > 0;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (!(await ensureOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Validate cadence bounds before touching the row.
  const min = body.cadence_min;
  const max = body.cadence_max;
  if (min !== undefined && (min < 1 || min > 14)) {
    return NextResponse.json({ error: "cadence_min out of range" }, { status: 400 });
  }
  if (max !== undefined && (max < 1 || max > 14)) {
    return NextResponse.json({ error: "cadence_max out of range" }, { status: 400 });
  }
  if (min !== undefined && max !== undefined && min > max) {
    return NextResponse.json({ error: "cadence_min > cadence_max" }, { status: 400 });
  }

  // Coalesce-based update lets us accept partial bodies without building SQL.
  const rows = (await sql`
    update installations set
      project_idea = coalesce(${body.project_idea ?? null}, project_idea),
      cadence_min = coalesce(${body.cadence_min ?? null}, cadence_min),
      cadence_max = coalesce(${body.cadence_max ?? null}, cadence_max),
      paused = coalesce(${body.paused ?? null}, paused)
    where id = ${id} and user_id = ${session.user.id}
    returning id, github_username, repo_owner, repo_name, branch, project_idea, timezone,
      cadence_min, cadence_max, paused, created_at
  `) as Array<Record<string, unknown>>;

  return NextResponse.json({ installation: rows[0] });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const rows = (await sql`
    delete from installations
    where id = ${id} and user_id = ${session.user.id}
    returning id
  `) as Array<{ id: string }>;

  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    deleted: rows[0].id,
    revoke_token_url:
      "https://github.com/settings/personal-access-tokens/active",
  });
}
