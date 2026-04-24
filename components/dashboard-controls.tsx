"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  installationId: string;
  initialPaused: boolean;
  initialIdea: string;
};

export function DashboardControls({ installationId, initialPaused, initialIdea }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [idea, setIdea] = useState(initialIdea);
  const [editingIdea, setEditingIdea] = useState(false);
  const [busy, setBusy] = useState<"pause" | "idea" | "disconnect" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function togglePause() {
    setErr(null);
    setBusy("pause");
    const next = !paused;
    try {
      const res = await fetch(`/api/installations/${installationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (!res.ok) {
        setErr("could not update");
        return;
      }
      setPaused(next);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveIdea() {
    setErr(null);
    setBusy("idea");
    try {
      const res = await fetch(`/api/installations/${installationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_idea: idea }),
      });
      if (!res.ok) {
        setErr("could not save idea");
        return;
      }
      setEditingIdea(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    const ok = confirm(
      "disconnect and delete this installation? your github commits stay — the bot just stops. " +
        "you'll want to also revoke the token on github.",
    );
    if (!ok) return;
    setErr(null);
    setBusy("disconnect");
    try {
      const res = await fetch(`/api/installations/${installationId}`, { method: "DELETE" });
      if (!res.ok) {
        setErr("could not disconnect");
        return;
      }
      const body = (await res.json()) as { revoke_token_url?: string };
      const url = body.revoke_token_url;
      if (url) {
        alert(
          "installation removed. now open github and revoke the token:\n\n" + url,
        );
        window.open(url, "_blank", "noopener,noreferrer");
      }
      router.push("/connect");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn-ghost" onClick={togglePause} disabled={busy === "pause"}>
          {busy === "pause" ? "…" : paused ? "resume" : "pause"}
        </button>
        <span className="hint">
          status: <span className={paused ? "err" : "ok"}>{paused ? "paused" : "active"}</span>
        </span>
      </div>

      <div className="stack">
        <label className="label" htmlFor="idea-edit">
          project idea
        </label>
        {editingIdea ? (
          <>
            <textarea
              id="idea-edit"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="form-control"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                borderRadius: 8,
                padding: "12px 14px",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                minHeight: 80,
                outline: "none",
              }}
            />
            <div className="row">
              <button className="btn-ghost" onClick={saveIdea} disabled={busy === "idea"}>
                {busy === "idea" ? "saving…" : "save"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setEditingIdea(false);
                  setIdea(initialIdea);
                }}
              >
                cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, maxWidth: 620 }}>{idea || <span className="dim">(none set)</span>}</p>
            <button className="btn-ghost" onClick={() => setEditingIdea(true)}>
              edit
            </button>
          </>
        )}
      </div>

      <div className="row">
        <button className="btn-ghost btn-danger" onClick={disconnect} disabled={busy === "disconnect"}>
          {busy === "disconnect" ? "disconnecting…" : "disconnect"}
        </button>
        <span className="hint dim">deletes the installation. revoke the token on github after.</span>
      </div>

      {err ? <div className="err hint">{err}</div> : null}
    </div>
  );
}
