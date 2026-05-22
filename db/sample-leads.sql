-- =============================================================
-- SAMPLE LEADS — auto-seeded on first cycle if leads table is empty.
-- These are realistic but fictional, so Isaiah sees a working CRM
-- on day one before the cron has had time to find real leads.
-- =============================================================

insert into leads (
  external_id, source, source_url, source_post_content, source_post_at,
  person_name, company_name, email, website, location, state, is_east_coast,
  industry, company_size, matched_keywords, intent_signal, intent_category,
  research_status, research_summary, pain_points, buying_signals, recommended_services,
  outreach_angle, lead_score, score_breakdown, status, notified, last_researched_at
) values
-- 1. Top-tier: East Coast SMB, fired their agency, has budget
(
  'sample:reddit-001',
  'reddit',
  'https://www.reddit.com/r/smallbusiness/comments/example1',
  'Just fired our marketing agency after 8 months and $24K with nothing to show for it. We''re a HVAC company in Tampa FL doing about $1.2M/year. Honest reviews on what to look for next? We need leads more than anything. Already have a CRM (HubSpot) but the agency was supposed to drive traffic and they couldn''t.',
  now() - interval '2 hours',
  'tampa_hvac_owner', 'Sunshine HVAC Solutions', 'mike@sunshinehvac.example.com',
  'https://sunshinehvac.example.com', 'Tampa, FL', 'FL', true,
  'Home Services / HVAC', '6-20 employees',
  array['fired our agency', 'need leads', 'need more leads', 'marketing agency'],
  'Just fired our marketing agency after 8 months and $24K with nothing to show for it',
  'complaint',
  'completed',
  'HVAC company in Tampa, FL doing $1.2M/year, recently fired their previous agency after spending $24K with no results. They already have HubSpot but need real lead generation — perfect fit for Aventis done-for-you marketing services + potentially our white-label AI chatbot for after-hours lead capture. East Coast, has proven budget ($3K/month was the previous agency spend), founder is clearly the decision-maker and is actively shopping.',
  array['Previous agency wasted budget', 'No measurable lead growth', 'HVAC has high seasonality', 'Phone calls likely going to voicemail after-hours'],
  array['Spent $24K on previous agency (budget exists)', 'Already uses HubSpot (sophisticated buyer)', 'Asking publicly for recommendations', 'Recent decision to switch (urgent)'],
  array['Done-for-you paid ads (Google + Meta)', 'AventisAI chatbot for after-hours lead capture', 'Local SEO for HVAC keywords', 'Email/SMS nurture sequences'],
  'Saw your Reddit post about firing your agency — we work with HVAC operators in your revenue range and I can show you exactly where the $24K went wrong in 15 minutes if you''re open to a quick call.',
  92,
  '{"intent_strength":18,"budget_indicators":19,"decision_maker_likely":19,"fit_with_aventis":18,"east_coast_bonus":18,"reasoning":"All signals strong: explicit need, proven budget, decision maker, perfect East Coast fit"}',
  'new', false, now() - interval '1 hour'
),
-- 2. White-label SaaS opportunity (agency owner)
(
  'sample:reddit-002',
  'reddit',
  'https://www.reddit.com/r/agency/comments/example2',
  'Running a 4-person marketing agency in Philadelphia, mostly SMB clients. Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend? Need something that lets me add my logo and resell to clients.',
  now() - interval '5 hours',
  'agency_phila', 'NorthStar Marketing Co', 'jenny@northstar-marketing.example.com',
  'https://northstar-marketing.example.com', 'Philadelphia, PA', 'PA', true,
  'Marketing Agency', '4 employees',
  array['white label software', 'white label crm', 'marketing agency'],
  'Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend?',
  'service',
  'completed',
  '4-person marketing agency in Philadelphia explicitly looking for white-label CRM to resell to SMB clients. This is the IDEAL customer profile for Aventis white-label software — they''re already doing the work of building CRMs manually, which proves both need and willingness to pay. Philadelphia is core East Coast market.',
  array['Building custom CRM per client in Airtable (inefficient)', 'Scaling to more clients with manual tooling', 'No recurring SaaS revenue stream'],
  array['Already running an agency (proven business model)', 'Explicitly asking for white-label', 'East Coast market', 'Size suggests $50K-$500K/yr agency revenue'],
  array['Aventis white-label CRM (primary fit)', 'White-label AI tools (upsell)', 'Partnership program / co-selling'],
  'Hey Jenny — saw your post about Airtable CRMs being a pain. We built Aventis exactly for agencies like yours: rebrand it, mark it up, resell. Happy to show you the partner dashboard if interesting.',
  90,
  '{"intent_strength":20,"budget_indicators":17,"decision_maker_likely":20,"fit_with_aventis":20,"east_coast_bonus":18,"reasoning":"Textbook white-label prospect, explicit intent, founder-level, perfect product fit"}',
  'new', false, now() - interval '4 hours'
),
-- 3. New business launching, no marketing yet
(
  'sample:bluesky-001',
  'bluesky',
  'https://bsky.app/profile/example/post/abc123',
  'Just launched my online boutique after 3 years of dreaming about it! 🎉 ChicAtlanta.shop is live. Already overwhelmed — anyone have advice for getting your first 100 customers? Atlanta-based, women''s fashion, ages 25-40.',
  now() - interval '12 hours',
  'Emma Chen', 'Chic Atlanta', null, 'https://chicatlanta.example.com',
  'Atlanta, GA', 'GA', true,
  'E-commerce / Fashion', 'solo founder',
  array['just launched', 'getting first customers', 'small business'],
  'Just launched my online boutique — anyone have advice for getting your first 100 customers?',
  'launching',
  'completed',
  'Newly-launched women''s fashion boutique in Atlanta, GA. Solo founder Emma Chen is asking the public for help getting first customers — clear signal she has no marketing partner yet. Shopify-based store, fashion vertical converts well with Meta ads + influencer marketing. East Coast, decision maker, but budget likely thin so done-for-you services may not fit — better as AventisAI tools (chatbot, content gen) or DIY consulting.',
  array['No marketing playbook yet', 'Solo founder = limited time', 'Customer acquisition cost likely unknown'],
  array['Already shipped — has product', 'Public ask = receptive to outreach', 'Identifiable niche (women 25-40 Atlanta)'],
  array['AventisAI content generator (cheap entry)', 'AI shopping assistant chatbot', 'Foundational Meta + TikTok ads setup'],
  'Congrats on launching — saw your post about getting your first 100 customers. I''ve helped 12 fashion DTC brands hit that milestone in under 60 days. Happy to share what worked in a 15-min call if useful.',
  78,
  '{"intent_strength":15,"budget_indicators":10,"decision_maker_likely":20,"fit_with_aventis":15,"east_coast_bonus":18,"reasoning":"Strong fit for AventisAI but limited budget for full services"}',
  'new', false, now() - interval '11 hours'
),
-- 4. Hiring signal — Boston marketing role
(
  'sample:indeed-001',
  'indeed',
  'https://www.indeed.com/viewjob?jk=examplejk1',
  'TechFlow Analytics is hiring: Marketing Manager, Boston MA. Full-time, on-site. We are a B2B analytics SaaS doing $4M ARR, growing 80% YoY, looking for our first marketing hire to build the function from scratch. Compensation: $95K-$130K + equity.',
  now() - interval '1 day',
  null, 'TechFlow Analytics', null, 'https://techflow.example.com',
  'Boston, MA', 'MA', true,
  'B2B SaaS / Analytics', '20-50 employees',
  array['marketing manager', 'hiring'],
  'TechFlow Analytics is hiring: Marketing Manager, Boston MA',
  'hiring',
  'completed',
  'B2B SaaS company TechFlow Analytics in Boston, MA — $4M ARR, 80% YoY growth, hiring their FIRST marketing manager at $95-130K + equity. The fact that they''re only just now hiring marketing means they don''t have any of the infrastructure yet — perfect window to offer fractional CMO services or done-for-you marketing while they get their hire ramped up. Plus, they''ll need tooling: CRM, automation, content.',
  array['No existing marketing function', 'High growth puts pressure on lead gen', 'New hire will take 3-6 months to be effective'],
  array['$4M ARR (clear budget)', 'Hiring at $95-130K (paying for talent)', '80% YoY growth (urgent need)', 'East Coast B2B = ideal Aventis customer'],
  array['Fractional CMO bridge engagement', 'White-label marketing automation stack', 'Done-for-you content + SEO while hire ramps'],
  'Saw you''re hiring your first marketing manager — that role takes 6 months to be effective. I help B2B SaaS companies your size bridge that gap with fractional execution. 15 minute call?',
  87,
  '{"intent_strength":17,"budget_indicators":20,"decision_maker_likely":15,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"Strong indirect signal — hiring marketing = needs marketing now"}',
  'new', false, now() - interval '20 hours'
),
-- 5. YC startup, growth-stage
(
  'sample:yc-001',
  'ycombinator',
  'https://www.ycombinator.com/companies/example-startup',
  'Stitchwell (YC W25): AI-powered inventory management for boutique retailers. We help fashion + home goods stores predict what to reorder. Based in New York, team of 4, B2B SaaS, $50/month per store. Currently 80 customers, looking to scale to 500.',
  now() - interval '3 days',
  null, 'Stitchwell', 'founders@stitchwell.example.com', 'https://stitchwell.example.com',
  'New York, NY', 'NY', true,
  'B2B SaaS / Retail Tech', '4 employees',
  array['yc startup', 'funded', 'b2b saas'],
  'YC W25 startup: AI-powered inventory management for boutique retailers, 80 customers, scaling to 500',
  'launching',
  'completed',
  'YC W25 batch B2B SaaS startup based in NYC. Has product-market fit (80 paying customers at $50/mo = $48K ARR) and is now scaling. Classic Aventis fit: they''ve proven the product works but need real marketing engine to scale to 500 customers. They probably don''t have a marketing person yet (team of 4 = founders only). White-label tools less likely since they''re tech-first, but done-for-you growth services are a perfect fit.',
  array['Need to scale from 80 to 500 customers (6x growth)', 'Tiny team (no marketing hire yet)', 'Niche audience (boutique retailers) needs specific channel strategy'],
  array['YC-backed (capital)', 'Already has paying customers (PMF)', 'NYC East Coast', 'Growth-stage = critical inflection point'],
  array['Done-for-you growth marketing', 'Retail-vertical content strategy', 'Email + paid acquisition playbook'],
  'Saw Stitchwell on YC — congrats on the batch. The jump from 80 to 500 customers is the hardest one and rarely happens organically. I''ve helped 5 YC SaaS companies do it. Open to a quick conversation?',
  85,
  '{"intent_strength":12,"budget_indicators":20,"decision_maker_likely":18,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"YC-funded, NYC, proven traction, no marketing hire yet"}',
  'new', false, now() - interval '2 days 22 hours'
),
-- 6. ProductHunt launch
(
  'sample:producthunt-001',
  'producthunt',
  'https://www.producthunt.com/posts/example-product',
  'ZenFlow — AI-powered task manager that prioritizes your day automatically. We just launched on ProductHunt! Built by a solo founder in Miami. Looking for our first 1000 users.',
  now() - interval '6 hours',
  'Carlos Mendez', 'ZenFlow', null, 'https://getzenflow.example.com',
  'Miami, FL', 'FL', true,
  'Productivity SaaS', 'solo founder',
  array['just launched', 'looking for users'],
  'Just launched on ProductHunt! Built by a solo founder in Miami. Looking for our first 1000 users.',
  'launching',
  'completed',
  'Solo founder Carlos Mendez in Miami, FL launching ZenFlow (productivity SaaS) on ProductHunt today. Active need for users + growth marketing. Limited budget likely as solo founder, but high motivation. Better fit for AventisAI tools (cheap white-label) than full-service marketing, plus could be a long-term partner if their app gets traction.',
  array['No customer acquisition channel yet', 'Solo founder = limited bandwidth', 'PH traffic spike is temporary'],
  array['Just launched (active phase)', 'Miami = East Coast', 'Solo = decision maker', 'Has a working product'],
  array['AventisAI tools (low-cost entry)', 'PH launch consulting', 'Initial content + SEO setup'],
  'Carlos — saw ZenFlow on PH today. The 7 days after launch are the most important. I''ve helped 8 SaaS launches convert PH traffic into long-term users. Free 15-min call if useful?',
  72,
  '{"intent_strength":13,"budget_indicators":8,"decision_maker_likely":20,"fit_with_aventis":13,"east_coast_bonus":18,"reasoning":"Strong intent + East Coast but solo founder has limited budget"}',
  'new', false, now() - interval '5 hours'
),
-- 7. East coast new business registration
(
  'sample:business-registry-001',
  'businessregistry',
  'https://opencorporates.com/companies/us_va/example-llc',
  'Coastal Catering Collective LLC — newly registered LLC in Norfolk, VA. Incorporated 2 months ago. Address: 1247 Bay Ave, Norfolk VA 23507.',
  now() - interval '5 days',
  null, 'Coastal Catering Collective LLC', null, null,
  'Norfolk, VA', 'VA', true,
  'Food Services / Catering', 'unknown',
  array['new business', 'launching'],
  'Newly registered LLC in Norfolk, VA — Coastal Catering Collective',
  'launching',
  'completed',
  'Newly-registered catering business in Norfolk, Virginia (East Coast). Only 2 months old per state filing. No website found, no online presence — which means they''re probably running on referrals/word-of-mouth currently. PRIME prospect for done-for-you website + local SEO + Google Business Profile setup. Catering is a high-margin local business where 1-2 new bookings/month covers the cost of our services.',
  array['No online presence detected', 'New business = no customer pipeline', 'Local-only marketing currently'],
  array['Just registered (timing window)', 'Local business = recurring monthly need', 'East Coast'],
  array['Done-for-you website + Google Business Profile', 'Local SEO for "catering norfolk"', 'AventisAI booking chatbot'],
  'Hi — saw Coastal Catering Collective registered with the state recently. Congrats! Most new catering businesses lose 6 months to word-of-mouth before getting serious about marketing. I have a 90-day playbook specifically for new catering ops. Happy to send it free if you want?',
  68,
  '{"intent_strength":8,"budget_indicators":12,"decision_maker_likely":15,"fit_with_aventis":15,"east_coast_bonus":18,"reasoning":"New East Coast business with no online presence = clear opportunity"}',
  'new', false, now() - interval '4 days 22 hours'
),
-- 8. Indie Hackers — agency pivot
(
  'sample:indiehackers-001',
  'indiehackers',
  'https://www.indiehackers.com/post/example-post',
  'After 3 years as a freelance designer, pivoting to a full agency. Setting up Slack, hiring my first designer, and need to figure out my tech stack. What CRM, project management, and automation do other small agencies use? Based in Charlotte NC.',
  now() - interval '8 hours',
  'David Park', 'Park Design Co', null, 'https://parkdesign.example.com',
  'Charlotte, NC', 'NC', true,
  'Design Agency', '2 employees',
  array['agency', 'tech stack', 'crm'],
  'Pivoting from freelance to full agency — what CRM, project management, and automation do other small agencies use?',
  'service',
  'completed',
  'David Park in Charlotte NC, scaling from freelance designer to design agency. Asking publicly about CRM/PM/automation stack. EXCELLENT timing — they''re evaluating tools right now, before any habits form. White-label CRM that handles client portal + project management is a perfect pitch. East Coast.',
  array['No tool stack chosen yet', 'First hire coming = need workflow', 'Likely $0 spent on infrastructure today'],
  array['Actively researching tools (purchase intent)', 'East Coast', 'Founder/decision maker'],
  array['Aventis white-label CRM + client portal', 'AventisAI design brief assistant', 'Project management module'],
  'David — saw your post on IH about the agency pivot. Most design agencies bolt together 6 tools that don''t talk to each other. We built ours specifically for design/marketing agencies so you can rebrand + resell client access. Want to see a 5-min walkthrough?',
  82,
  '{"intent_strength":16,"budget_indicators":13,"decision_maker_likely":18,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"Active buying mode, perfect product fit, East Coast"}',
  'new', false, now() - interval '7 hours'
),
-- 9. Lower-tier, archived example for filter testing
(
  'sample:reddit-003',
  'reddit',
  'https://www.reddit.com/r/marketing/comments/example3',
  'Wondering if AI tools are worth it for marketing? I run a small bakery in LA. Probably not the right sub but figured I''d ask.',
  now() - interval '2 days',
  'bakery_curious', null, null, null,
  'Los Angeles, CA', 'CA', false,
  'Food / Bakery', 'small',
  array['ai marketing tool', 'small business'],
  'Wondering if AI tools are worth it for marketing? I run a small bakery in LA.',
  'intent',
  'completed',
  'Small bakery owner in Los Angeles, CA, casually asking about AI tools. Low intent, west coast (lower priority), small business with limited budget. Worth a quick reply but not a high-priority lead.',
  array['Tiny budget likely', 'Casual interest only'],
  array['Asking publicly (open to outreach)'],
  array['AventisAI free tier / content gen', 'Educational outreach (not sales)'],
  'Happy to share what AI tools work for food businesses your size — DM me and I''ll send our free guide.',
  42,
  '{"intent_strength":8,"budget_indicators":4,"decision_maker_likely":15,"fit_with_aventis":10,"east_coast_bonus":5,"reasoning":"Low intent + West Coast + tiny business"}',
  'archived', false, now() - interval '1 day 22 hours'
),
-- 10. High-score East Coast complaint
(
  'sample:twitter-001',
  'twitter',
  'https://twitter.com/example/status/12345',
  'Our marketing agency just told us they''re raising their retainer 40% next year. We''re a 30-person law firm in Charleston SC — anyone got recommendations? Want to interview alternatives before we sign.',
  now() - interval '4 hours',
  'Sarah Mitchell', 'Mitchell & Associates Law', 'sarah@mitchellassoc.example.com',
  'https://mitchellassoc.example.com', 'Charleston, SC', 'SC', true,
  'Legal Services', '30 employees',
  array['marketing agency', 'replace agency', 'recommendations'],
  'Our marketing agency just told us they''re raising their retainer 40% next year — anyone got recommendations?',
  'complaint',
  'completed',
  'Sarah Mitchell, partner-level at a 30-person law firm in Charleston, SC. Current agency just raised retainer 40%. Actively shopping for alternatives BEFORE the increase hits. Legal vertical has very high LTV — typical law firm marketing retainer is $5K-$15K/month. This is a top-tier signal: existing budget, motivated to switch, decision maker.',
  array['Cost increase pressure', 'Likely overpaying current agency', 'Legal vertical = high competition'],
  array['Currently spending on agency ($5-15K/mo likely)', '30-person firm (proven business)', 'East Coast', 'Senior decision maker'],
  array['Done-for-you legal marketing (Google Ads, local SEO)', 'White-label intake automation', 'AventisAI client-screening chatbot'],
  'Saw your post — 40% mid-contract increases are insane in legal. I work with 6 law firms in your size range and can audit your current spend for free. 20 min call?',
  91,
  '{"intent_strength":19,"budget_indicators":19,"decision_maker_likely":17,"fit_with_aventis":18,"east_coast_bonus":18,"reasoning":"Top-tier: budget + intent + decision maker + East Coast"}',
  'new', false, now() - interval '3 hours'
)
on conflict (external_id) do nothing;

-- Insert a sample generation_run so the dashboard has cycle history
insert into generation_runs (
  started_at, completed_at, status, sources_attempted, sources_succeeded,
  raw_signals_found, leads_created, leads_researched, leads_qualified,
  notification_sent
) values (
  now() - interval '30 minutes',
  now() - interval '28 minutes',
  'completed',
  array['reddit','hackernews','google','twitter','indeed','producthunt','indiehackers','businessregistry','bluesky','github','stackexchange','devto','lobsters','ycombinator'],
  array['reddit','hackernews','indiehackers','bluesky','github','stackexchange','devto','lobsters','ycombinator','businessregistry'],
  47, 10, 10, 8, true
);

-- Insert a sample activity for the top lead so timeline isn't empty
insert into lead_activities (lead_id, type, title, content, created_by)
select id, 'research_update', 'AI research completed', research_summary, 'system'
from leads where external_id = 'sample:reddit-001';
