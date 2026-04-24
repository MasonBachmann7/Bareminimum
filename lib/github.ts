import { Octokit } from "@octokit/rest";

export type ValidateResult =
  | {
      ok: true;
      github_username: string;
      github_email: string;
      default_branch: string;
      expires_at: string | null;
    }
  | { ok: false; error: string };

export type RepoSummary = {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};

export type RepoFile = {
  path: string;
  size: number;
  sha: string;
};

export type RepoFileWithContent = RepoFile & {
  content: string;
  truncated: boolean;
};

const FILE_READ_CAP = 2048;

export function octokitFor(pat: string): Octokit {
  return new Octokit({ auth: pat });
}

/**
 * Verifies a fine-grained PAT for a specific repo. We check:
 *   1. Token identifies a user (GET /user).
 *   2. We can read the repo (GET /repos/{owner}/{repo}) — required both for
 *      repo existence and to confirm the PAT's repository selection.
 *   3. There's a verified primary email (GET /user/emails).
 *
 * We do NOT explicitly probe the `contents:write` permission — the GitHub
 * REST API doesn't expose scope introspection for fine-grained tokens. A
 * failed write surfaces at commit time; the docs guidance on /connect tells
 * the user to select Contents: Read and write, which is all we can enforce.
 */
export async function validatePat(
  pat: string,
  repo_owner: string,
  repo_name: string,
): Promise<ValidateResult> {
  if (!pat.trim()) return { ok: false, error: "token is empty" };
  const octokit = octokitFor(pat);

  let username: string;
  try {
    const me = await octokit.users.getAuthenticated();
    username = me.data.login;
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status === 401) return { ok: false, error: "token rejected by github" };
    return { ok: false, error: "could not identify token" };
  }

  let default_branch: string;
  try {
    const repo = await octokit.repos.get({ owner: repo_owner, repo: repo_name });
    default_branch = repo.data.default_branch;
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status === 404) return { ok: false, error: "repo not found or token has no access to it" };
    return { ok: false, error: "could not reach repo" };
  }

  let email: string | null = null;
  try {
    const emails = await octokit.users.listEmailsForAuthenticatedUser();
    const primary = emails.data.find((e) => e.primary && e.verified);
    email = primary?.email ?? null;
  } catch {
    return {
      ok: false,
      error: "token cannot read verified emails (enable the 'email addresses (read)' permission)",
    };
  }
  if (!email) {
    return { ok: false, error: "no verified primary email on this github account" };
  }

  return {
    ok: true,
    github_username: username,
    github_email: email,
    default_branch,
    expires_at: null,
  };
}

export async function listUserRepos(pat: string): Promise<RepoSummary[]> {
  const octokit = octokitFor(pat);
  const repos = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
    affiliation: "owner,collaborator",
  });
  return repos.data.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    full_name: r.full_name,
    default_branch: r.default_branch ?? "main",
    private: r.private,
  }));
}

/**
 * Returns the tree of the branch (up to `limit` files) plus the raw contents
 * of the `contentsFor` most recently modified files (truncated to ~2KB each).
 */
export async function readRepoContext(
  pat: string,
  owner: string,
  repo: string,
  branch: string,
  opts: { limit?: number; contentsFor?: number } = {},
): Promise<{ files: RepoFile[]; recent: RepoFileWithContent[]; empty: boolean }> {
  const limit = opts.limit ?? 30;
  const contentsFor = opts.contentsFor ?? 8;
  const octokit = octokitFor(pat);

  let branchSha: string;
  try {
    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    branchSha = ref.data.object.sha;
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status === 404 || status === 409) {
      return { files: [], recent: [], empty: true };
    }
    throw e;
  }

  const commit = await octokit.git.getCommit({ owner, repo, commit_sha: branchSha });
  const tree = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: commit.data.tree.sha,
    recursive: "1",
  });

  const files: RepoFile[] = tree.data.tree
    .filter((t) => t.type === "blob" && t.path && t.sha)
    .slice(0, limit)
    .map((t) => ({
      path: t.path!,
      size: t.size ?? 0,
      sha: t.sha!,
    }));

  // Pick `contentsFor` files by recency. The git tree itself doesn't carry
  // per-file mtimes, so we approximate by querying the commits endpoint for
  // the latest commit touching each path. Bounded by `contentsFor` so this
  // caps API calls.
  const candidates = files.slice(0, Math.min(files.length, 20));
  const withDates = await Promise.all(
    candidates.map(async (f) => {
      try {
        const commits = await octokit.repos.listCommits({
          owner,
          repo,
          sha: branch,
          path: f.path,
          per_page: 1,
        });
        const when = commits.data[0]?.commit.author?.date ?? commits.data[0]?.commit.committer?.date ?? "";
        return { file: f, when };
      } catch {
        return { file: f, when: "" };
      }
    }),
  );
  withDates.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  const picks = withDates.slice(0, contentsFor).map((w) => w.file);

  const recent = await Promise.all(
    picks.map(async (f): Promise<RepoFileWithContent> => {
      try {
        const blob = await octokit.git.getBlob({ owner, repo, file_sha: f.sha });
        const raw = Buffer.from(blob.data.content, blob.data.encoding as BufferEncoding).toString("utf8");
        const truncated = raw.length > FILE_READ_CAP;
        const content = truncated ? raw.slice(0, FILE_READ_CAP) + "\n... [truncated]" : raw;
        return { ...f, content, truncated };
      } catch {
        return { ...f, content: "", truncated: false };
      }
    }),
  );

  return { files, recent, empty: false };
}

export type CommitInput = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  message: string;
  content: string;
  author: { name: string; email: string };
};

export type CommitResult = {
  sha: string;
  lines_added: number;
};

/** Creates or updates `path` on `branch`. Returns the commit SHA. */
export async function commitFile(pat: string, input: CommitInput): Promise<CommitResult> {
  const octokit = octokitFor(pat);

  let sha: string | undefined;
  let prevContent = "";
  try {
    const existing = await octokit.repos.getContent({
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.branch,
    });
    if (!Array.isArray(existing.data) && existing.data.type === "file") {
      sha = existing.data.sha;
      prevContent = Buffer.from(existing.data.content, "base64").toString("utf8");
    }
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status !== 404) throw e;
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    message: input.message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch: input.branch,
    sha,
    author: input.author,
    committer: input.author,
  });

  const lines_added = Math.max(0, input.content.split("\n").length - prevContent.split("\n").length);
  return {
    sha: res.data.commit.sha ?? "",
    lines_added,
  };
}
