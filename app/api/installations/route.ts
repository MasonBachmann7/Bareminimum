import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { encryptPat } from "@/lib/crypto";
import { validatePat } from "@/lib/github";
import { isValidTimezone } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  pat?: string;
  repo_owner?: string;
  repo_name?: string;
  project_idea?: string;
  timezone?: string;
  branch?: string;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { pat, repo_owner, repo_name, project_idea, timezone, branch } = body;
  if (!pat || !repo_owner || !repo_name) {
    return NextResponse.json(
      { error: "pat, repo_owner, repo_name are required" },
      { status: 400 },
    );
  }
  const tz = timezone && isValidTimezone(timezone) ? timezone : "UTC";

  // Re-validate on write — never trust the client's earlier /validate.
  const v = await validatePat(pat, repo_owner, repo_name);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const encrypted = await encryptPat(pat);
  const useBranch = branch && branch.trim() ? branch.trim() : v.default_branch;

  const rows = (await sql`
    insert into installations (
      user_id, github_username, github_email,
      repo_owner, repo_name, branch,
      encrypted_pat, project_idea, timezone
    ) values (
      ${session.user.id}, ${v.github_username}, ${v.github_email},
      ${repo_owner}, ${repo_name}, ${useBranch},
      ${encrypted}, ${project_idea ?? null}, ${tz}
    )
    returning id, github_username, repo_owner, repo_name, branch, project_idea, timezone,
      cadence_min, cadence_max, paused, created_at
  `) as Array<{
    id: string;
    github_username: string;
    repo_owner: string;
    repo_name: string;
    branch: string;
    project_idea: string | null;
    timezone: string;
    cadence_min: number;
    cadence_max: number;
    paused: boolean;
    created_at: string;
  }>;

  return NextResponse.json({ installation: rows[0] }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await sql`
    select id, github_username, repo_owner, repo_name, branch, project_idea, timezone,
      cadence_min, cadence_max, paused, created_at
    from installations
    where user_id = ${session.user.id}
    order by created_at desc
  `;

  return NextResponse.json({ installations: rows });
}
