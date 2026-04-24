import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { decryptPat } from "@/lib/crypto";
import { commitFile, readRepoContext } from "@/lib/github";
import { planNextCommit } from "@/lib/anthropic";
import { localParts } from "@/lib/dates";
import { dailyPlan, inWindow } from "@/lib/schedule";

export const runtime = "nodejs";
// Tick must never be cached, even by accident.
export const dynamic = "force-dynamic";
// Give each tick room to process a few installations at ~15s budget each.
export const maxDuration = 300;

type InstallationRow = {
  id: string;
  user_id: string;
  github_username: string;
  github_email: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  encrypted_pat: Uint8Array;
  project_idea: string | null;
  timezone: string;
  cadence_min: number;
  cadence_max: number;
};

type Outcome =
  | { id: string; action: "skipped_window" }
  | { id: string; action: "skipped_not_in_plan" }
  | { id: string; action: "already_done" }
  | { id: string; action: "haiku_failed" }
  | { id: string; action: "committed"; sha: string }
  | { id: string; action: "error"; reason: string };

async function processInstallation(row: InstallationRow): Promise<Outcome> {
  const now = new Date();
  const local = localParts(now, row.timezone);
  if (!inWindow(local.hour)) return { id: row.id, action: "skipped_window" };

  const plan = dailyPlan(row.id, local.isoDate, row.cadence_min, row.cadence_max);
  if (!plan.hours.includes(local.hour)) {
    return { id: row.id, action: "skipped_not_in_plan" };
  }

  // Idempotency: if we already committed in the last 55 minutes for this
  // installation, assume this tick is a duplicate/retry and bail. Hourly
  // cron cadence means any same-hour re-run is handled by this check.
  const recent = (await sql`
    select 1
    from commits_log
    where installation_id = ${row.id}
      and committed_at > now() - interval '55 minutes'
    limit 1
  `) as unknown[];
  if (recent.length > 0) return { id: row.id, action: "already_done" };

  const pat = await decryptPat(row.encrypted_pat);

  const ctx = await readRepoContext(pat, row.repo_owner, row.repo_name, row.branch, {
    limit: 30,
    contentsFor: 8,
  });

  const commitPlan = await planNextCommit({
    projectIdea: row.project_idea ?? "",
    branch: row.branch,
    recent: ctx.recent,
    files: ctx.files,
  });
  if (!commitPlan) return { id: row.id, action: "haiku_failed" };

  const result = await commitFile(pat, {
    owner: row.repo_owner,
    repo: row.repo_name,
    branch: row.branch,
    path: commitPlan.file_path,
    message: commitPlan.commit_message,
    content: commitPlan.new_content,
    author: { name: row.github_username, email: row.github_email },
  });

  await sql`
    insert into commits_log (installation_id, sha, file_path, message, lines_added)
    values (${row.id}, ${result.sha}, ${commitPlan.file_path}, ${commitPlan.commit_message}, ${result.lines_added})
  `;

  return { id: row.id, action: "committed", sha: result.sha };
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = (await sql`
    select
      id, user_id, github_username, github_email,
      repo_owner, repo_name, branch,
      encrypted_pat, project_idea, timezone,
      cadence_min, cadence_max
    from installations
    where paused = false
  `) as InstallationRow[];

  const outcomes: Outcome[] = [];
  for (const row of rows) {
    try {
      outcomes.push(await processInstallation(row));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      // Never include PATs or repo contents in logs/responses.
      console.error(`[cron] installation ${row.id} failed:`, reason);
      outcomes.push({ id: row.id, action: "error", reason });
    }
  }

  return NextResponse.json({
    processed: rows.length,
    outcomes,
  });
}

// Vercel Cron sends GET; expose the same handler.
export const GET = POST;
