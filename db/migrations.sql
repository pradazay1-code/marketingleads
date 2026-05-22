-- =============================================================
-- AVENTIS LEADS — migrations
-- Run this in Neon SQL Editor if you set up the DB before v2.
-- It is idempotent: safe to run multiple times.
-- New installs: just run schema.sql, you don't need this.
-- =============================================================

-- v2: deep-research fields
alter table leads add column if not exists outreach_email_draft text;
alter table leads add column if not exists outreach_dm_draft text;
alter table leads add column if not exists next_actions text[];
alter table leads add column if not exists tech_stack text[];
alter table leads add column if not exists social_links jsonb;
alter table leads add column if not exists domain_age_estimate text;

-- v2: audit log for user actions
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text default 'anonymous',
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_actor on audit_log (actor, created_at desc);
create index if not exists idx_audit_resource on audit_log (resource_type, resource_id);

-- v2: saved views (saved filters)
create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filters jsonb not null,
  created_by text default 'isaiah',
  created_at timestamptz default now()
);

-- v2: sessions (for simple cookie-based auth)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  user_label text default 'isaiah',
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);
create index if not exists idx_sessions_token on sessions (token);
create index if not exists idx_sessions_expires on sessions (expires_at);

-- Insert seeds for new sources that didn't exist in v1
insert into sources (name, type, config) values
  ('Bluesky — intent search', 'bluesky', '{"queries":["looking for a marketing agency","need help with marketing","need more leads"]}'),
  ('GitHub — new SaaS/startups', 'github', '{"topics":["saas","startup","marketing"]}'),
  ('Stack Exchange — Webmasters', 'stackexchange', '{"sites":["webmasters","freelancing"]}'),
  ('DEV.to — startup tag', 'devto', '{"tags":["startup","marketing","saas"]}'),
  ('Lobste.rs — new posts', 'lobsters', '{}'),
  ('Y Combinator — recent batches', 'ycombinator', '{"batches":["W25","S24","W24"]}')
on conflict (name) do nothing;
