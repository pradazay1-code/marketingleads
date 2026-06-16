-- =============================================================
-- AVENTIS LEADS — migrations
-- Run this in Neon SQL Editor if you set up the DB before v3.
-- Idempotent: safe to run multiple times.
-- New installs: just run schema.sql, you don't need this.
-- =============================================================

-- v2: deep-research fields
alter table leads add column if not exists outreach_email_draft text;
alter table leads add column if not exists outreach_dm_draft text;
alter table leads add column if not exists next_actions text[];
alter table leads add column if not exists tech_stack text[];
alter table leads add column if not exists social_links jsonb;
alter table leads add column if not exists domain_age_estimate text;

-- v3: contactability + quality gate fields
alter table leads add column if not exists contactability_score integer default 0;
alter table leads add column if not exists has_email boolean default false;
alter table leads add column if not exists has_phone boolean default false;
alter table leads add column if not exists has_website boolean default false;
alter table leads add column if not exists has_linkedin boolean default false;
alter table leads add column if not exists contact_emails text[];
alter table leads add column if not exists contact_phones text[];
alter table leads add column if not exists email_confidence text;
alter table leads add column if not exists best_email text;
alter table leads add column if not exists best_phone text;

create index if not exists idx_leads_contactability on leads (contactability_score desc);
create index if not exists idx_leads_has_email on leads (has_email);

-- v2 audit + sessions
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

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filters jsonb not null,
  created_by text default 'isaiah',
  created_at timestamptz default now()
);

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

-- v3: remove low-quality sources, add high-quality ones
delete from sources where type in ('hackernews','lobsters','devto','stackexchange','bluesky','reddit_search');

insert into sources (name, type, config) values
  ('Google Maps Places — East Coast service businesses', 'googlemaps', '{"industries":["hvac","law firm","dental","real estate","catering"]}'),
  ('News — funding announcements', 'newsfunding', '{"queries":["raises seed","series A","series B"]}'),
  ('GitHub — new SaaS/startups', 'github', '{"topics":["saas","startup","marketing"]}'),
  ('Y Combinator — recent batches', 'ycombinator', '{"batches":["W25","S24","W24"]}'),
  ('Reddit — Small Business', 'reddit', '{"subreddits":["smallbusiness","Entrepreneur","startups","marketing","SEO"]}'),
  ('Indie Hackers — Posts', 'indiehackers', '{}'),
  ('Business Registry — East Coast', 'businessregistry', '{}'),
  ('Indeed — Marketing Job Postings', 'indeed', '{}'),
  ('ProductHunt — New Launches', 'producthunt', '{}'),
  ('Twitter/X — intent search', 'twitter', '{}'),
  ('Google — Intent Search', 'google', '{}')
on conflict (name) do nothing;

-- v3: clean out historical leads from removed sources (optional — comment out
-- the next line if you want to keep them around).
update leads set status = 'archived' where source in ('hackernews','lobsters','devto','stackexchange','bluesky');
