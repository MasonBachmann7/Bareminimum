"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Repo = {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};

type IntrospectState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; username: string; email: string; repos: Repo[] }
  | { kind: "err"; message: string };

export function ConnectForm() {
  const router = useRouter();
  const [pat, setPat] = useState("");
  const [introspect, setIntrospect] = useState<IntrospectState>({ kind: "idle" });
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [idea, setIdea] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastCheckedPat = useRef<string>("");

  useEffect(() => {
    try {
      const stashed = sessionStorage.getItem("bareminimum:idea");
      if (stashed) setIdea(stashed);
    } catch {}
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}
  }, []);

  async function check(patValue: string) {
    if (!patValue.trim() || patValue === lastCheckedPat.current) return;
    lastCheckedPat.current = patValue;
    setIntrospect({ kind: "checking" });
    try {
      const res = await fetch("/api/installations/repos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pat: patValue }),
      });
      const body = (await res.json()) as
        | { github_username: string; github_email: string; repos: Repo[] }
        | { error: string };
      if (!res.ok || "error" in body) {
        setIntrospect({ kind: "err", message: "error" in body ? body.error : "check failed" });
        return;
      }
      setIntrospect({
        kind: "ok",
        username: body.github_username,
        email: body.github_email,
        repos: body.repos,
      });
      if (body.repos.length > 0 && !selectedRepo) {
        setSelectedRepo(body.repos[0].full_name);
      }
    } catch {
      setIntrospect({ kind: "err", message: "network error" });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (introspect.kind !== "ok") {
      setSubmitError("paste a valid token first");
      return;
    }
    if (!selectedRepo) {
      setSubmitError("pick a repo");
      return;
    }
    const [repo_owner, repo_name] = selectedRepo.split("/");
    setSubmitting(true);
    try {
      const res = await fetch("/api/installations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pat,
          repo_owner,
          repo_name,
          project_idea: idea.trim() || null,
          timezone,
        }),
      });
      const body = (await res.json()) as { installation?: { id: string }; error?: string };
      if (!res.ok || !body.installation) {
        setSubmitError(body.error ?? "could not save");
        return;
      }
      try {
        sessionStorage.removeItem("bareminimum:idea");
      } catch {}
      router.push("/dashboard");
    } catch {
      setSubmitError("network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} autoComplete="off">
      <label className="label" htmlFor="pat">
        fine-grained personal access token
      </label>
      <input
        id="pat"
        type="password"
        name="pat"
        spellCheck={false}
        autoComplete="off"
        placeholder="github_pat_..."
        value={pat}
        onChange={(e) => {
          setPat(e.target.value);
          if (introspect.kind !== "idle") setIntrospect({ kind: "idle" });
        }}
        onBlur={() => check(pat)}
      />
      <div className="hint">
        {introspect.kind === "idle" && "paste the token you just created. we never log or display it."}
        {introspect.kind === "checking" && "checking with github…"}
        {introspect.kind === "ok" && (
          <span className="check ok">
            ✓ hi, {introspect.username} — commits will be authored as {introspect.email}
          </span>
        )}
        {introspect.kind === "err" && <span className="err">✗ {introspect.message}</span>}
      </div>

      <label className="label" htmlFor="repo">
        target repo
      </label>
      <select
        id="repo"
        value={selectedRepo}
        onChange={(e) => setSelectedRepo(e.target.value)}
        disabled={introspect.kind !== "ok"}
      >
        <option value="">— select a repo —</option>
        {introspect.kind === "ok" &&
          introspect.repos.map((r) => (
            <option key={r.full_name} value={r.full_name}>
              {r.full_name}
              {r.private ? " (private)" : ""}
            </option>
          ))}
      </select>

      <label className="label" htmlFor="idea">
        what should we build?
      </label>
      <textarea
        id="idea"
        name="idea"
        placeholder="What should we build? e.g. 'a CLI that tracks my coffee intake', 'a tiny markdown wiki', 'the SaaS i keep tweeting about'"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
      />

      <div className="hint">timezone: <code>{timezone}</code> (detected from your browser)</div>

      <button type="submit" disabled={submitting || introspect.kind !== "ok"}>
        <span>{submitting ? "saving…" : "start doing less"}</span>
      </button>
      {submitError ? <div className="err hint">{submitError}</div> : null}
    </form>
  );
}
