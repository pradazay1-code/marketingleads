-- =============================================================
-- AVENTIS LEADS — migrations
-- Run this in Neon SQL Editor to upgrade an existing database.
-- Idempotent: safe to run multiple times.
-- New installs: just run schema.sql instead.
-- =============================================================

-- ── v2: deep-research fields ─────────────────────────────────
alter table leads add column if not exists outreach_email_draft text;
alter table leads add column if not exists outreach_dm_draft text;
alter table leads add column if not exists next_actions text[];
alter table leads add column if not exists tech_stack text[];
alter table leads add column if not exists social_links jsonb;
alter table leads add column if not exists domain_age_estimate text;

-- ── v3: contactability + quality gate ────────────────────────
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

-- ── v4: vertical focus (junk removal + real estate) + mapping ─
alter table leads add column if not exists vertical text default 'other';
alter table leads add column if not exists latitude double precision;
alter table leads add column if not exists longitude double precision;
alter table leads add column if not exists geocoded_address text;
alter table leads add column if not exists outreach_phone_script text;
alter table leads add column if not exists estimated_monthly_value integer;
alter table leads add column if not exists uses_lead_marketplace boolean;
alter table leads add column if not exists services_offered text[];

create index if not exists idx_leads_vertical on leads (vertical);
create index if not exists idx_leads_geo on leads (latitude, longitude);

-- ── v2 support tables ────────────────────────────────────────
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

-- ── v4: purge sources that no longer fit the two verticals ────
delete from sources where type in (
  'hackernews','lobsters','devto','stackexchange','bluesky',
  'github','ycombinator','producthunt','indiehackers','newsfunding','reddit_search'
);

insert into sources (name, type, config) values
  ('Google Maps — junk removal + real estate', 'googlemaps', '{"verticals":["junk_removal","real_estate"]}'),
  ('Firecrawl — vertical prospecting', 'firecrawl', '{"mode":["pain_search","directory"]}'),
  ('Reddit — vertical subreddits + search', 'reddit', '{"subreddits":["junkremoval","realtors","realestateinvesting","sweatystartup","PropertyManagement"]}'),
  ('Indeed — vertical hiring signals', 'indeed', '{"roles":["junk removal driver","real estate ISA","transaction coordinator"]}'),
  ('Business Registry — new hauling/realty LLCs', 'businessregistry', '{"terms":["junk removal","hauling","cleanout","realty","property management"]}'),
  ('Google — vertical intent search', 'google', '{}'),
  ('Twitter/X — vertical intent search', 'twitter', '{}')
on conflict (name) do nothing;

-- ── v4: replace the keyword set with vertical-specific terms ──
-- Old generic marketing keywords produced too much off-target noise.
delete from keywords where category in ('intent','pain','service','launch','hiring','complaint')
  and phrase not in (
    'looking for a marketing agency','need help with marketing','need more leads',
    'not getting leads','fired our agency','fired our marketing agency',
    'looking to replace our agency','white label crm','white label software',
    'ai phone answering','ai receptionist','google local services ads',
    'local seo','google business profile','need more reviews','just started my business'
  );

insert into keywords (phrase, category, weight) values
  ('junk removal', 'vertical_junk', 10),
  ('junk hauling', 'vertical_junk', 10),
  ('hauling business', 'vertical_junk', 9),
  ('estate cleanout', 'vertical_junk', 9),
  ('property cleanout', 'vertical_junk', 9),
  ('debris removal', 'vertical_junk', 8),
  ('dumpster rental', 'vertical_junk', 8),
  ('furniture removal', 'vertical_junk', 8),
  ('angi leads', 'pain_junk', 10),
  ('angies list leads', 'pain_junk', 10),
  ('thumbtack leads', 'pain_junk', 10),
  ('cost per lead too high', 'pain_junk', 9),
  ('1-800-got-junk', 'pain_junk', 9),
  ('competing with got junk', 'pain_junk', 10),
  ('missed calls losing jobs', 'pain_junk', 9),
  ('slow season junk removal', 'pain_junk', 8),
  ('real estate agent', 'vertical_re', 9),
  ('realtor', 'vertical_re', 9),
  ('real estate team', 'vertical_re', 10),
  ('real estate brokerage', 'vertical_re', 10),
  ('property management', 'vertical_re', 9),
  ('real estate investor', 'vertical_re', 8),
  ('listing agent', 'vertical_re', 8),
  ('zillow leads', 'pain_re', 10),
  ('zillow premier agent', 'pain_re', 10),
  ('realtor.com leads', 'pain_re', 10),
  ('lead response time', 'pain_re', 9),
  ('leads falling through', 'pain_re', 9),
  ('need a better crm', 'pain_re', 10),
  ('idx website', 'pain_re', 8),
  ('seller leads', 'pain_re', 9),
  ('motivated seller leads', 'pain_re', 9),
  ('follow up sequence', 'pain_re', 8),
  ('sphere of influence', 'pain_re', 7)
on conflict (phrase) do nothing;

-- ── v4: archive leads from retired sources and off-vertical leads ──
update leads set status = 'archived'
where source in (
  'hackernews','lobsters','devto','stackexchange','bluesky',
  'github','ycombinator','producthunt','indiehackers','newsfunding'
) and status not in ('won','opportunity');
