import { NextResponse } from "next/server";
import { validatePat } from "@/lib/github";

export const runtime = "nodejs";

type Body = {
  pat?: string;
  repo_owner?: string;
  repo_name?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const { pat, repo_owner, repo_name } = body;
  if (!pat || !repo_owner || !repo_name) {
    return NextResponse.json(
      { ok: false, error: "pat, repo_owner, and repo_name are required" },
      { status: 400 },
    );
  }

  const result = await validatePat(pat, repo_owner, repo_name);
  if (!result.ok) {
    return NextResponse.json(result, { status: 200 });
  }

  // Never echo the PAT back in any form.
  return NextResponse.json({
    ok: true,
    github_username: result.github_username,
    github_email: result.github_email,
    default_branch: result.default_branch,
  });
}
