-- =============================================================
-- AVENTIS LEADS — database schema (Postgres)
-- Run this once in Neon → SQL Editor after creating your project.
-- Works on any Postgres (Neon, Supabase, RDS, local).
-- =============================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------
-- LEADS: every prospect we've discovered
-- -----------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),

  -- dedupe key: source + their unique id on that source
  external_id text unique,
  source text not null,                  -- 'reddit', 'hackernews', 'google', 'twitter', 'indeed', 'producthunt', 'businessregistry'
  source_url text,
  source_post_content text,              -- raw text of the post / signal we found
  source_post_at timestamptz,

  -- person / company
  person_name text,
  company_name text,
  email text,
  phone text,
  website text,
  linkedin_url text,
  twitter_handle text,
  location text,
  state text,
  is_east_coast boolean default false,
  industry text,
  company_size text,

  -- intent
  matched_keywords text[],
  intent_signal text,                    -- the actual sentence that triggered the match
  intent_category text,                  -- 'pain', 'shopping', 'hiring', 'launching', 'complaint'

  -- research
  research_status text default 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  research_summary text,
  research_data jsonb,
  pain_points text[],
  buying_signals text[],
  recommended_services text[],           -- which Aventis offerings fit
  outreach_angle text,                   -- AI-generated personalized opening
  outreach_email_draft text,             -- AI-generated cold email draft
  outreach_dm_draft text,                -- AI-generated DM/short message draft
  next_actions text[],                   -- AI-suggested next steps
  tech_stack text[],                     -- detected tech stack
  social_links jsonb,                    -- detected social media URLs
  domain_age_estimate text,              -- domain age from Wayback
  last_researched_at timestamptz,

  -- scoring
  lead_score integer default 0,          -- 0-100
  score_breakdown jsonb,

  -- pipeline state (CRM)
  status text default 'new',             -- 'new', 'contacted', 'qualified', 'opportunity', 'won', 'lost', 'archived'
  assigned_to text,

  -- notification tracking
  notified boolean default false,
  notified_at timestamptz,
  notification_batch_id uuid,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_leads_status on leads (status);
create index if not exists idx_leads_score on leads (lead_score desc);
create index if not exists idx_leads_created on leads (created_at desc);
create index if not exists idx_leads_research_status on leads (research_status);
create index if not exists idx_leads_east_coast on leads (is_east_coast);
create index if not exists idx_leads_source on leads (source);

-- -----------------------------------------------
-- ACTIVITIES: every event on a lead (calls, notes, emails, status changes, research updates)
-- -----------------------------------------------
create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  type text not null,                    -- 'note', 'email_sent', 'email_received', 'call', 'status_change', 'research_update', 'system'
  title text,
  content text,
  metadata jsonb,
  created_at timestamptz default now(),
  created_by text default 'system'
);

create index if not exists idx_activities_lead on lead_activities (lead_id, created_at desc);

-- -----------------------------------------------
-- OPPORTUNITIES: revenue pipeline
-- -----------------------------------------------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  name text not null,
  service_type text,                     -- 'white-label-saas', 'marketing-services', 'ai-tools', 'ad-management', 'web-design', etc
  estimated_mrr decimal(10,2),
  estimated_one_time decimal(10,2),
  probability integer default 25,        -- 0-100
  stage text default 'discovery',        -- 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  expected_close_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_opps_stage on opportunities (stage);
create index if not exists idx_opps_lead on opportunities (lead_id);

-- -----------------------------------------------
-- GENERATION_RUNS: each 4-hour batch
-- -----------------------------------------------
create table if not exists generation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text default 'running',         -- 'running', 'completed', 'failed'
  sources_attempted text[],
  sources_succeeded text[],
  raw_signals_found integer default 0,   -- total signals across sources
  leads_created integer default 0,       -- after dedup
  leads_researched integer default 0,
  leads_qualified integer default 0,     -- score >= threshold
  notification_sent boolean default false,
  errors jsonb,
  metadata jsonb
);

create index if not exists idx_runs_started on generation_runs (started_at desc);

-- -----------------------------------------------
-- KEYWORDS: configurable triggers
-- -----------------------------------------------
create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  phrase text not null unique,
  category text default 'intent',        -- 'pain', 'intent', 'service', 'launch', 'complaint'
  weight integer default 1,              -- score contribution when matched
  enabled boolean default true,
  created_at timestamptz default now()
);

-- -----------------------------------------------
-- SOURCES: configurable lead sources
-- -----------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null,                    -- 'reddit', 'hackernews', 'google', 'twitter', 'indeed', 'producthunt'
  enabled boolean default true,
  config jsonb,                          -- subreddits, queries, etc
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);

-- -----------------------------------------------
-- NOTIFICATIONS: outgoing message log
-- -----------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  channel text not null,                 -- 'sms', 'email', 'push'
  recipient text,
  subject text,
  body text,
  status text default 'pending',         -- 'pending', 'sent', 'failed'
  provider_id text,
  provider_response jsonb,
  lead_ids uuid[],
  batch_id uuid,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- -----------------------------------------------
-- SYSTEM_LOG: every cron tick, every error, audit trail
-- -----------------------------------------------
create table if not exists system_log (
  id uuid primary key default gen_random_uuid(),
  level text default 'info',             -- 'info', 'warn', 'error'
  event text not null,
  message text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_log_created on system_log (created_at desc);
create index if not exists idx_log_event on system_log (event);

-- =============================================================
-- TRIGGERS: keep updated_at fresh
-- =============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists leads_updated on leads;
create trigger leads_updated before update on leads
  for each row execute function set_updated_at();

drop trigger if exists opportunities_updated on opportunities;
create trigger opportunities_updated before update on opportunities
  for each row execute function set_updated_at();

-- =============================================================
-- SEED: default keywords and sources
-- =============================================================
insert into keywords (phrase, category, weight) values
  ('looking for a marketing agency', 'intent', 10),
  ('need help with marketing', 'intent', 9),
  ('hire a marketing agency', 'intent', 10),
  ('marketing agency recommendations', 'intent', 9),
  ('need a marketing consultant', 'intent', 9),
  ('looking for marketing services', 'intent', 9),
  ('marketing freelancer', 'intent', 7),
  ('white label software', 'service', 10),
  ('white label saas', 'service', 10),
  ('white label crm', 'service', 9),
  ('white label automation', 'service', 9),
  ('need a new website', 'service', 7),
  ('redesign my website', 'service', 7),
  ('low conversion rate', 'pain', 8),
  ('not getting leads', 'pain', 9),
  ('need more leads', 'pain', 9),
  ('struggling to get clients', 'pain', 8),
  ('seo help', 'service', 6),
  ('google ads help', 'service', 7),
  ('facebook ads help', 'service', 7),
  ('marketing automation', 'service', 7),
  ('ai for my business', 'service', 8),
  ('ai marketing tool', 'service', 8),
  ('chatbot for my business', 'service', 7),
  ('just launched', 'launch', 5),
  ('just opened', 'launch', 5),
  ('new business', 'launch', 4),
  ('grand opening', 'launch', 6),
  ('hiring a marketing manager', 'hiring', 8),
  ('hiring a marketing director', 'hiring', 8),
  ('cmo search', 'hiring', 7),
  ('agency ripped me off', 'complaint', 9),
  ('agency was terrible', 'complaint', 9),
  ('fired our agency', 'complaint', 9),
  ('looking to replace our agency', 'complaint', 10)
on conflict (phrase) do nothing;

insert into sources (name, type, config) values
  ('Reddit — Small Business', 'reddit', '{"subreddits":["smallbusiness","Entrepreneur","startups","EntrepreneurRideAlong","marketing","SEO","sweatystartup","SaaS","b2bmarketing","advertising"],"limit":50}'),
  ('Reddit — Intent Search', 'reddit_search', '{"queries":["looking for marketing agency","fired our marketing agency","need more leads"]}'),
  ('Hacker News — Show & Ask', 'hackernews', '{"types":["show","ask"],"limit":100}'),
  ('Google — Intent Search', 'google', '{"queries":["looking for marketing agency","need help with marketing","best white label software"]}'),
  ('Indeed — Marketing Job Postings', 'indeed', '{"queries":["marketing manager","marketing director","cmo"],"location":"east coast"}'),
  ('ProductHunt — New Launches', 'producthunt', '{"limit":30}'),
  ('Indie Hackers — Posts', 'indiehackers', '{"limit":50}'),
  ('Bluesky — intent search', 'bluesky', '{"queries":["looking for a marketing agency","need help with marketing","need more leads"]}'),
  ('GitHub — new SaaS/startups', 'github', '{"topics":["saas","startup","marketing"]}'),
  ('Stack Exchange — Webmasters', 'stackexchange', '{"sites":["webmasters","freelancing"]}'),
  ('DEV.to — startup tag', 'devto', '{"tags":["startup","marketing","saas"]}'),
  ('Lobste.rs — new posts', 'lobsters', '{}'),
  ('Y Combinator — recent batches', 'ycombinator', '{"batches":["W25","S24","W24"]}'),
  ('Business Registry — East Coast', 'businessregistry', '{"jurisdictions":["us_fl","us_ny","us_nj","us_pa","us_ma","us_ga","us_nc","us_sc","us_va","us_md","us_ct"]}')
on conflict (name) do nothing;

-- v2 tables: audit log, saved views, sessions
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

-- Neon doesn't have built-in auth like Supabase, so no row-level security
-- policies are needed. Access is gated by who has DATABASE_URL (env vars only).
