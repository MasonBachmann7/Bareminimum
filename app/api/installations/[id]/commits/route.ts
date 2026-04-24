import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Join-on-ownership: one query, returns empty if not owned or not found.
  const rows = (await sql`
    select c.id, c.sha, c.file_path, c.message, c.lines_added, c.committed_at,
      i.repo_owner, i.repo_name
    from commits_log c
    join installations i on i.id = c.installation_id
    where c.installation_id = ${id}
      and i.user_id = ${session.user.id}
    order by c.committed_at desc
    limit 20
  `) as Array<{
    id: string;
    sha: string;
    file_path: string;
    message: string;
    lines_added: number;
    committed_at: string;
    repo_owner: string;
    repo_name: string;
  }>;

  const commits = rows.map((r) => ({
    id: r.id,
    sha: r.sha,
    sha_short: r.sha.slice(0, 7),
    file_path: r.file_path,
    message: r.message,
    lines_added: r.lines_added,
    committed_at: r.committed_at,
    url: `https://github.com/${r.repo_owner}/${r.repo_name}/commit/${r.sha}`,
  }));

  return NextResponse.json({ commits });
}
