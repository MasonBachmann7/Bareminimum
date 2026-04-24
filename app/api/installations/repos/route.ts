import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listUserRepos, octokitFor } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { pat?: string };

/**
 * Introspects a fresh PAT during onboarding: returns the authenticated
 * username, their verified primary email, and a repo list scoped by the
 * token. Called on blur from /connect to drive the repo dropdown.
 *
 * Nothing from the PAT is ever echoed or logged.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.pat) {
    return NextResponse.json({ error: "pat required" }, { status: 400 });
  }

  const octokit = octokitFor(body.pat);

  let username: string;
  try {
    const me = await octokit.users.getAuthenticated();
    username = me.data.login;
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status === 401) {
      return NextResponse.json({ error: "token rejected by github" }, { status: 400 });
    }
    return NextResponse.json({ error: "could not identify token" }, { status: 400 });
  }

  let email: string | null = null;
  try {
    const emails = await octokit.users.listEmailsForAuthenticatedUser();
    const primary = emails.data.find((e) => e.primary && e.verified);
    email = primary?.email ?? null;
  } catch {
    return NextResponse.json(
      {
        error: "token cannot read verified emails — enable 'email addresses (read)'",
      },
      { status: 400 },
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "no verified primary email on this github account" },
      { status: 400 },
    );
  }

  try {
    const repos = await listUserRepos(body.pat);
    return NextResponse.json({
      github_username: username,
      github_email: email,
      repos,
    });
  } catch {
    return NextResponse.json({ error: "could not list repos with that token" }, { status: 400 });
  }
}
