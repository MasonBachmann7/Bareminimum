"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn("resend", {
        email,
        redirect: false,
        redirectTo: "/connect",
      });
      if (res?.error) {
        setError("could not send the magic link. double-check the address.");
      } else {
        // Match Auth.js's verify-request convention for a consistent UX.
        window.location.href = "/login?sent=1";
      }
    } catch {
      setError("something broke. try again in a sec.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} autoComplete="email">
      <input
        type="email"
        name="email"
        placeholder="you@yourdomain.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting || !email}>
        <span>{submitting ? "sending…" : "send magic link"}</span>
      </button>
      {error ? <div className="err hint">{error}</div> : null}
    </form>
  );
}
