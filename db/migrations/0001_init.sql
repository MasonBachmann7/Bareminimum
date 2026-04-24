-- bareminimum v1 initial schema
-- Neon / Postgres. Run once with psql against DATABASE_URL_UNPOOLED.
-- Auth tables are provisioned separately once the auth adapter is wired.

create extension if not exists pgcrypto;

create table if not exists public.installations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                -- from Auth.js session (adapter-issued id)
  github_username text not null,
  github_email text not null,           -- verified primary email; used as commit author
  repo_owner text not null,
  repo_name text not null,
  branch text not null default 'main',
  encrypted_pat bytea not null,         -- pgp_sym_encrypt(pat, key)
  pat_expires_at timestamptz,
  project_idea text,
  timezone text not null default 'UTC',
  cadence_min int not null default 3,
  cadence_max int not null default 6,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  check (cadence_min >= 1 and cadence_min <= cadence_max and cadence_max <= 14)
);
create index if not exists installations_user_id_idx on public.installations (user_id);
create index if not exists installations_active_idx on public.installations (paused) where paused = false;

create table if not exists public.commits_log (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references public.installations(id) on delete cascade not null,
  sha text not null,
  file_path text not null,
  message text not null,
  lines_added int not null,
  committed_at timestamptz not null default now()
);
create index if not exists commits_log_installation_committed_idx
  on public.commits_log (installation_id, committed_at desc);

-- No RLS: ownership is enforced in the API layer because Auth.js sessions
-- don't hydrate a Postgres role the way Supabase's auth.uid() does.
