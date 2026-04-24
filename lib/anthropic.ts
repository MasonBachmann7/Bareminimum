import Anthropic from "@anthropic-ai/sdk";
import type { RepoFileWithContent } from "@/lib/github";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

export type HaikuCommitPlan = {
  file_path: string;
  new_content: string;
  commit_message: string;
};

const SYSTEM_PROMPT = `You are writing incremental code for a developer's side project. Produce ONE small, self-contained change — typically 20 to 35 lines of actual code — representing a single logical step. Output ONE JSON object and nothing else.

Rules:
- The change must be coherent given the existing files.
- Prefer adding focused new code over rewriting large sections.
- If no files exist yet, create a sensible starter scaffold: a README and one entrypoint file.
- Pick the language from the project goal and existing file extensions.
- Commit messages are lowercase, imperative, no trailing period. Examples: "add health check endpoint", "wire up config loader", "draft readme".

Output schema (strict):
{
  "file_path": string,
  "new_content": string,
  "commit_message": string
}

"new_content" must be the FULL new content of the file after your change, not a diff.`;

function buildFileList(recent: RepoFileWithContent[], allFiles: { path: string }[]): string {
  const shownPaths = new Set(recent.map((f) => f.path));
  const extras = allFiles.map((f) => f.path).filter((p) => !shownPaths.has(p));

  const parts: string[] = [];
  if (recent.length === 0 && extras.length === 0) {
    parts.push("(repo is empty — create a starter scaffold)");
  } else {
    if (recent.length > 0) {
      parts.push("Most recently modified files (with contents):");
      for (const f of recent) {
        parts.push(`--- ${f.path} ---`);
        parts.push(f.content);
      }
    }
    if (extras.length > 0) {
      parts.push("");
      parts.push("Other files (paths only):");
      for (const p of extras) parts.push(`- ${p}`);
    }
  }
  return parts.join("\n");
}

function extractJson(text: string): unknown {
  // Strip accidental code fences if the model ignores instructions.
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenced ? fenced[1] : trimmed;
  return JSON.parse(raw);
}

function asPlan(value: unknown): HaikuCommitPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.file_path !== "string" ||
    typeof v.new_content !== "string" ||
    typeof v.commit_message !== "string"
  ) {
    return null;
  }
  if (!v.file_path.trim() || !v.new_content.trim() || !v.commit_message.trim()) return null;
  return {
    file_path: v.file_path.trim(),
    new_content: v.new_content,
    commit_message: v.commit_message.trim(),
  };
}

async function callHaiku(
  client: Anthropic,
  userMessage: string,
  temperature: number,
): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const firstBlock = res.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("haiku returned no text block");
  }
  return firstBlock.text;
}

/**
 * Asks Haiku for one commit-sized change. Returns null if it refuses to return
 * parseable JSON even on the low-temperature retry — the caller must skip the
 * hour rather than ship a junk commit.
 */
export async function planNextCommit(params: {
  projectIdea: string;
  branch: string;
  recent: RepoFileWithContent[];
  files: { path: string }[];
}): Promise<HaikuCommitPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  const fileList = buildFileList(params.recent, params.files);
  const userMessage = [
    "Project goal:",
    params.projectIdea || "(not specified yet)",
    "",
    `Repo branch: ${params.branch}`,
    "",
    "Existing files:",
    fileList,
    "",
    "Write the next step.",
  ].join("\n");

  for (const temperature of [0.7, 0.3]) {
    try {
      const text = await callHaiku(client, userMessage, temperature);
      const parsed = extractJson(text);
      const plan = asPlan(parsed);
      if (plan) return plan;
    } catch {
      // fall through to retry
    }
  }
  return null;
}
