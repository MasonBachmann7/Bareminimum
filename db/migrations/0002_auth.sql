-- Auth.js v5 tables for @auth/pg-adapter, UUID variant.
-- The quoted camelCase column names are not a stylistic choice — the pg
-- adapter's SQL queries reference them case-sensitively.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text,
  unique (provider, "providerAccountId")
);
create index if not exists accounts_user_id_idx on accounts ("userId");

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" text unique not null
);
create index if not exists sessions_user_id_idx on sessions ("userId");

create table if not exists verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);
