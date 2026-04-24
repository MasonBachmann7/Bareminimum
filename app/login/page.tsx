import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;

  return (
    <div className="shell">
      <nav className="top">
        <Brand />
        <div className="nav-links">
          <a href="/">home</a>
        </div>
      </nav>

      <section className="cta">
        <h2 className="section-title">{sent ? "check your email." : "log in."}</h2>
        {sent ? (
          <p className="dim" style={{ maxWidth: 520 }}>
            we sent a magic link to the address you gave us. click it and you&apos;ll land on
            the onboarding page. if it doesn&apos;t arrive in a minute, check spam or try again.
          </p>
        ) : (
          <>
            <p className="dim" style={{ maxWidth: 520, marginBottom: 18 }}>
              we&apos;ll email you a magic link. no passwords, no pretending to remember one.
            </p>
            <LoginForm />
          </>
        )}
        {error ? (
          <p className="err hint" style={{ marginTop: 14 }}>
            something went wrong: {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
