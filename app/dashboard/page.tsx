import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { DashboardControls } from "@/components/dashboard-controls";
import { auth, signOut } from "@/lib/auth";
import { sql } from "@/lib/db";
import { localParts, relativeTime } from "@/lib/dates";
import { hoursUntilNextCommit } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InstallationRow = {
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
};

type CommitRow = {
  id: string;
  sha: string;
  file_path: string;
  message: string;
  lines_added: number;
  committed_at: string;
};

function isoDateOffset(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const installs = (await sql`
    select id, github_username, repo_owner, repo_name, branch, project_idea,
      timezone, cadence_min, cadence_max, paused, created_at
    from installations
    where user_id = ${session.user.id}
    order by created_at desc
    limit 1
  `) as InstallationRow[];

  if (installs.length === 0) redirect("/connect");
  const install = installs[0];

  const commitsRaw = (await sql`
    select id, sha, file_path, message, lines_added, committed_at
    from commits_log
    where installation_id = ${install.id}
    order by committed_at desc
    limit 10
  `) as CommitRow[];

  const countRows = (await sql`
    select count(*)::int as c from commits_log where installation_id = ${install.id}
  `) as Array<{ c: number }>;
  const totalCommits = countRows[0]?.c ?? 0;

  const now = new Date();
  const local = localParts(now, install.timezone);
  const todayIso = local.isoDate;
  const tomorrowIso = isoDateOffset(todayIso, 1);

  const next = install.paused
    ? null
    : hoursUntilNextCommit({
        installationId: install.id,
        todayIsoDate: todayIso,
        tomorrowIsoDate: tomorrowIso,
        localHour: local.hour,
        cadenceMin: install.cadence_min,
        cadenceMax: install.cadence_max,
      });

  const repoUrl = `https://github.com/${install.repo_owner}/${install.repo_name}`;

  return (
    <div className="shell">
      <nav className="top">
        <Brand />
        <div className="nav-links">
          <a href="/">home</a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            style={{ display: "inline" }}
          >
            <button
              type="submit"
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
                marginLeft: 22,
              }}
            >
              sign out
            </button>
          </form>
        </div>
      </nav>

      <section style={{ marginBottom: 28 }}>
        <h2 className="section-title">
          quietly contributing to{" "}
          <a href={repoUrl} target="_blank" rel="noreferrer">
            {install.repo_owner}/{install.repo_name}
          </a>
        </h2>
        <p className="dim hint">
          timezone {install.timezone} · {install.cadence_min}–{install.cadence_max} commits/day
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 36,
        }}
      >
        <div className="tile">
          <h4>total commits</h4>
          <div className="big">{totalCommits}</div>
        </div>
        <div className="tile">
          <h4>next commit</h4>
          <div className="big">
            {install.paused
              ? "—"
              : next
              ? `~${next.hours}h`
              : "tomorrow"}
          </div>
          {!install.paused && next ? (
            <div className="hint dim" style={{ marginTop: 6 }}>
              {next.tomorrow
                ? `first commit tomorrow at ${String(next.nextLocalHour).padStart(2, "0")}:00 local`
                : `around ${String(next.nextLocalHour).padStart(2, "0")}:00 local`}
            </div>
          ) : null}
        </div>
        <div className="tile">
          <h4>status</h4>
          <div className="big">
            <span className={install.paused ? "err" : "ok"}>
              {install.paused ? "paused" : "active"}
            </span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h3 className="label" style={{ marginBottom: 12 }}>
          recent commits
        </h3>
        {commitsRaw.length === 0 ? (
          <p className="dim hint">
            none yet. the first will land the next time the local time is between 9:00 and 22:00 and
            today&apos;s plan lines up.
          </p>
        ) : (
          <ul className="commit-list">
            {commitsRaw.map((c) => (
              <li key={c.id} className="commit-row">
                <a
                  className="sha"
                  href={`${repoUrl}/commit/${c.sha}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.sha.slice(0, 7)}
                </a>
                <span className="msg">{c.message}</span>
                <span className="when">{relativeTime(new Date(c.committed_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 48 }}>
        <h3 className="label" style={{ marginBottom: 12 }}>
          controls
        </h3>
        <DashboardControls
          installationId={install.id}
          initialPaused={install.paused}
          initialIdea={install.project_idea ?? ""}
        />
      </section>

      <footer>
        <div>© 2026 bareminimum · probably satirical · definitely functional</div>
        <div>logged in as {session.user.email}</div>
      </footer>
    </div>
  );
}
