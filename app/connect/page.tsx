import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ConnectForm } from "@/components/connect-form";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const existing = (await sql`
    select id from installations where user_id = ${session.user.id} limit 1
  `) as Array<{ id: string }>;
  if (existing.length > 0) redirect("/dashboard");

  return (
    <div className="shell">
      <nav className="top">
        <Brand />
        <div className="nav-links">
          <a href="/">home</a>
        </div>
      </nav>

      <section className="stack-lg">
        <div>
          <h2 className="section-title">step 1 · create a token</h2>
          <p className="dim" style={{ maxWidth: 620, marginBottom: 14 }}>
            this is the only secret we need. a fine-grained personal access token scoped to
            one repo. it never leaves our server in plaintext and is encrypted at rest.
          </p>
          <a
            className="btn-link"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            create token on github ↗
          </a>
          <ol className="steps" style={{ marginTop: 18 }}>
            <li>
              <strong>token name:</strong> <code>bareminimum</code> (or anything).
            </li>
            <li>
              <strong>expiration:</strong> 1 year. longer is fine if your org allows it.
            </li>
            <li>
              <strong>repository access:</strong> <code>only select repositories</code>, then pick the repo you want the bot to commit to.
            </li>
            <li>
              <strong>repository permissions:</strong>
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>
                  <code>contents</code> → <strong>read and write</strong>
                </li>
                <li>
                  <code>metadata</code> → read (auto-selected)
                </li>
              </ul>
            </li>
            <li>
              <strong>account permissions:</strong>
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>
                  <code>email addresses</code> → read
                </li>
              </ul>
            </li>
            <li>copy the token (starts with <code>github_pat_</code>). paste below.</li>
          </ol>
        </div>

        <div>
          <h2 className="section-title">step 2 · paste &amp; describe</h2>
          <p className="dim" style={{ maxWidth: 620, marginBottom: 14 }}>
            we&apos;ll check the token, pull your repo list, and kick off the scheduler. first
            commit will land the next time you&apos;re inside business hours.
          </p>
          <ConnectForm />
        </div>
      </section>

      <footer>
        <div>© 2026 bareminimum · probably satirical · definitely functional</div>
        <div>logged in as {session.user.email}</div>
      </footer>
    </div>
  );
}
