import { db, log } from "./db";

/**
 * Auto-seed sample leads on first run when leads table is empty.
 * Runs at the start of every lead-gen cycle but is a no-op if leads exist.
 */
export async function seedSampleLeadsIfEmpty(): Promise<boolean> {
  const sql = db();
  try {
    const [{ count }] = (await sql`
      SELECT COUNT(*)::text AS count FROM leads
    `) as Array<{ count: string }>;
    if (parseInt(count, 10) > 0) return false;

    await log("info", "seed_starting", "Empty leads table — inserting sample data so dashboard isn't blank");

    // Sample leads — inlined to avoid file-read complications in serverless bundling
    await sql`
      INSERT INTO leads (
        external_id, source, source_url, source_post_content, source_post_at,
        person_name, company_name, email, website, location, state, is_east_coast,
        industry, company_size, matched_keywords, intent_signal, intent_category,
        research_status, research_summary, pain_points, buying_signals, recommended_services,
        outreach_angle, lead_score, score_breakdown, status, notified, last_researched_at
      ) VALUES
      (
        'sample:reddit-001', 'reddit',
        'https://www.reddit.com/r/smallbusiness/comments/example1',
        'Just fired our marketing agency after 8 months and $24K with nothing to show for it. We are a HVAC company in Tampa FL doing about $1.2M/year. Honest reviews on what to look for next? We need leads more than anything.',
        now() - interval '2 hours',
        'tampa_hvac_owner', 'Sunshine HVAC Solutions', 'mike@sunshinehvac.example.com',
        'https://sunshinehvac.example.com', 'Tampa, FL', 'FL', true,
        'Home Services / HVAC', '6-20 employees',
        ARRAY['fired our agency', 'need leads', 'need more leads', 'marketing agency'],
        'Just fired our marketing agency after 8 months and $24K with nothing to show for it',
        'complaint', 'completed',
        'HVAC company in Tampa, FL doing $1.2M/year, recently fired their previous agency after spending $24K with no results. They already have HubSpot but need real lead generation — perfect fit for Aventis done-for-you marketing services + potentially our white-label AI chatbot.',
        ARRAY['Previous agency wasted budget', 'No measurable lead growth', 'Phone calls likely going to voicemail after-hours'],
        ARRAY['Spent $24K on previous agency (budget exists)', 'Already uses HubSpot', 'Asking publicly for recommendations'],
        ARRAY['Done-for-you paid ads (Google + Meta)', 'AventisAI chatbot for after-hours lead capture', 'Local SEO for HVAC keywords'],
        'Saw your Reddit post about firing your agency — we work with HVAC operators in your revenue range and I can show you exactly where the $24K went wrong in 15 minutes if you are open to a quick call.',
        92,
        '{"intent_strength":18,"budget_indicators":19,"decision_maker_likely":19,"fit_with_aventis":18,"east_coast_bonus":18,"reasoning":"All signals strong"}'::jsonb,
        'new', false, now() - interval '1 hour'
      ),
      (
        'sample:reddit-002', 'reddit',
        'https://www.reddit.com/r/agency/comments/example2',
        'Running a 4-person marketing agency in Philadelphia, mostly SMB clients. Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend?',
        now() - interval '5 hours',
        'agency_phila', 'NorthStar Marketing Co', 'jenny@northstar-marketing.example.com',
        'https://northstar-marketing.example.com', 'Philadelphia, PA', 'PA', true,
        'Marketing Agency', '4 employees',
        ARRAY['white label software', 'white label crm', 'marketing agency'],
        'Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend?',
        'service', 'completed',
        '4-person marketing agency in Philadelphia explicitly looking for white-label CRM to resell to SMB clients. IDEAL customer profile for Aventis white-label software.',
        ARRAY['Building custom CRM per client in Airtable', 'Scaling clients with manual tooling', 'No recurring SaaS revenue stream'],
        ARRAY['Already running an agency', 'Explicitly asking for white-label', 'East Coast market'],
        ARRAY['Aventis white-label CRM (primary fit)', 'White-label AI tools (upsell)', 'Partnership program'],
        'Hey Jenny — saw your post about Airtable CRMs being a pain. We built Aventis exactly for agencies like yours: rebrand it, mark it up, resell.',
        90,
        '{"intent_strength":20,"budget_indicators":17,"decision_maker_likely":20,"fit_with_aventis":20,"east_coast_bonus":18,"reasoning":"Textbook white-label prospect"}'::jsonb,
        'new', false, now() - interval '4 hours'
      ),
      (
        'sample:bluesky-001', 'bluesky',
        'https://bsky.app/profile/example/post/abc123',
        'Just launched my online boutique after 3 years of dreaming about it! ChicAtlanta.shop is live. Already overwhelmed — anyone have advice for getting your first 100 customers? Atlanta-based, women fashion.',
        now() - interval '12 hours',
        'Emma Chen', 'Chic Atlanta', NULL, 'https://chicatlanta.example.com',
        'Atlanta, GA', 'GA', true,
        'E-commerce / Fashion', 'solo founder',
        ARRAY['just launched', 'getting first customers'],
        'Just launched my online boutique — anyone have advice for getting your first 100 customers?',
        'launching', 'completed',
        'Newly-launched women fashion boutique in Atlanta, GA. Solo founder asking publicly for help getting first customers. Fashion vertical converts well with Meta ads + influencer marketing.',
        ARRAY['No marketing playbook yet', 'Solo founder = limited time'],
        ARRAY['Already shipped — has product', 'Public ask = receptive', 'Identifiable niche'],
        ARRAY['AventisAI content generator', 'AI shopping assistant chatbot', 'Foundational Meta + TikTok ads setup'],
        'Congrats on launching — saw your post about getting your first 100 customers. Happy to share what worked for 12 other fashion DTC brands.',
        78,
        '{"intent_strength":15,"budget_indicators":10,"decision_maker_likely":20,"fit_with_aventis":15,"east_coast_bonus":18,"reasoning":"Strong fit but limited budget"}'::jsonb,
        'new', false, now() - interval '11 hours'
      ),
      (
        'sample:indeed-001', 'indeed',
        'https://www.indeed.com/viewjob?jk=examplejk1',
        'TechFlow Analytics is hiring: Marketing Manager, Boston MA. Full-time, on-site. B2B analytics SaaS $4M ARR, growing 80% YoY, looking for our first marketing hire. $95K-$130K + equity.',
        now() - interval '1 day',
        NULL, 'TechFlow Analytics', NULL, 'https://techflow.example.com',
        'Boston, MA', 'MA', true,
        'B2B SaaS / Analytics', '20-50 employees',
        ARRAY['marketing manager', 'hiring'],
        'TechFlow Analytics is hiring: Marketing Manager, Boston MA',
        'hiring', 'completed',
        'B2B SaaS in Boston, MA — $4M ARR, 80% YoY growth, hiring FIRST marketing manager. Perfect window for fractional CMO services while they ramp the new hire.',
        ARRAY['No existing marketing function', 'High growth pressure', 'New hire ramps slowly'],
        ARRAY['$4M ARR', '$95-130K compensation', '80% YoY growth', 'East Coast B2B'],
        ARRAY['Fractional CMO bridge engagement', 'White-label marketing automation', 'Done-for-you content + SEO'],
        'Saw you are hiring your first marketing manager — that role takes 6 months to be effective. I help B2B SaaS companies your size bridge that gap.',
        87,
        '{"intent_strength":17,"budget_indicators":20,"decision_maker_likely":15,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"Strong indirect signal"}'::jsonb,
        'new', false, now() - interval '20 hours'
      ),
      (
        'sample:yc-001', 'ycombinator',
        'https://www.ycombinator.com/companies/example-startup',
        'Stitchwell (YC W25): AI-powered inventory management for boutique retailers. NYC, team of 4, $50/mo per store. 80 customers, scaling to 500.',
        now() - interval '3 days',
        NULL, 'Stitchwell', 'founders@stitchwell.example.com', 'https://stitchwell.example.com',
        'New York, NY', 'NY', true,
        'B2B SaaS / Retail Tech', '4 employees',
        ARRAY['yc startup', 'funded', 'b2b saas'],
        'YC W25 startup: AI-powered inventory management, 80 customers, scaling to 500',
        'launching', 'completed',
        'YC W25 B2B SaaS in NYC. Product-market fit (80 paying customers = $48K ARR), scaling phase. Classic Aventis fit.',
        ARRAY['6x growth needed', 'Tiny team', 'Niche audience'],
        ARRAY['YC-backed (capital)', 'Paying customers (PMF)', 'NYC East Coast'],
        ARRAY['Done-for-you growth marketing', 'Retail-vertical content strategy', 'Email + paid acquisition'],
        'Saw Stitchwell on YC — the jump from 80 to 500 customers is the hardest one. I have helped 5 YC SaaS companies do it.',
        85,
        '{"intent_strength":12,"budget_indicators":20,"decision_maker_likely":18,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"YC-funded, NYC, proven traction"}'::jsonb,
        'new', false, now() - interval '2 days 22 hours'
      ),
      (
        'sample:twitter-001', 'twitter',
        'https://twitter.com/example/status/12345',
        'Our marketing agency just told us they are raising their retainer 40% next year. We are a 30-person law firm in Charleston SC — anyone got recommendations? Want to interview alternatives.',
        now() - interval '4 hours',
        'Sarah Mitchell', 'Mitchell & Associates Law', 'sarah@mitchellassoc.example.com',
        'https://mitchellassoc.example.com', 'Charleston, SC', 'SC', true,
        'Legal Services', '30 employees',
        ARRAY['marketing agency', 'replace agency', 'recommendations'],
        'Our marketing agency just told us they are raising their retainer 40% next year — anyone got recommendations?',
        'complaint', 'completed',
        'Partner-level at 30-person law firm in Charleston, SC. Current agency raising retainer 40%. Actively shopping. Legal vertical has very high LTV.',
        ARRAY['Cost increase pressure', 'Likely overpaying current agency'],
        ARRAY['Currently spending on agency ($5-15K/mo likely)', '30-person firm', 'East Coast', 'Senior decision maker'],
        ARRAY['Done-for-you legal marketing', 'White-label intake automation', 'AventisAI client-screening chatbot'],
        'Saw your post — 40% mid-contract increases are insane in legal. I can audit your current spend for free.',
        91,
        '{"intent_strength":19,"budget_indicators":19,"decision_maker_likely":17,"fit_with_aventis":18,"east_coast_bonus":18,"reasoning":"Top-tier: budget + intent + decision maker"}'::jsonb,
        'new', false, now() - interval '3 hours'
      ),
      (
        'sample:businessregistry-001', 'businessregistry',
        'https://opencorporates.com/companies/us_va/example-llc',
        'Coastal Catering Collective LLC — newly registered LLC in Norfolk, VA. Incorporated 2 months ago.',
        now() - interval '5 days',
        NULL, 'Coastal Catering Collective LLC', NULL, NULL,
        'Norfolk, VA', 'VA', true,
        'Food Services / Catering', 'unknown',
        ARRAY['new business', 'launching'],
        'Newly registered LLC in Norfolk, VA',
        'launching', 'completed',
        'Newly-registered catering business in Norfolk, Virginia. Only 2 months old. No website found.',
        ARRAY['No online presence', 'New business = no pipeline'],
        ARRAY['Just registered', 'Local business = recurring need', 'East Coast'],
        ARRAY['Done-for-you website + Google Business Profile', 'Local SEO', 'AventisAI booking chatbot'],
        'Saw Coastal Catering Collective registered with the state recently. Congrats! Most new catering businesses lose 6 months to word-of-mouth.',
        68,
        '{"intent_strength":8,"budget_indicators":12,"decision_maker_likely":15,"fit_with_aventis":15,"east_coast_bonus":18,"reasoning":"New East Coast business, no online presence"}'::jsonb,
        'new', false, now() - interval '4 days 22 hours'
      ),
      (
        'sample:indiehackers-001', 'indiehackers',
        'https://www.indiehackers.com/post/example-post',
        'After 3 years as a freelance designer, pivoting to a full agency. Need to figure out my tech stack. What CRM, project management, and automation do other small agencies use? Charlotte NC.',
        now() - interval '8 hours',
        'David Park', 'Park Design Co', NULL, 'https://parkdesign.example.com',
        'Charlotte, NC', 'NC', true,
        'Design Agency', '2 employees',
        ARRAY['agency', 'tech stack', 'crm'],
        'Pivoting from freelance to full agency — what CRM, project management, and automation do other small agencies use?',
        'service', 'completed',
        'David Park in Charlotte NC, scaling freelance to agency. Asking publicly about CRM/PM/automation stack. EXCELLENT timing — evaluating tools right now.',
        ARRAY['No tool stack chosen yet', 'First hire coming', '$0 spent on infrastructure'],
        ARRAY['Actively researching tools', 'East Coast', 'Founder/decision maker'],
        ARRAY['Aventis white-label CRM + client portal', 'AventisAI design brief assistant'],
        'David — saw your post on IH about the agency pivot. Most design agencies bolt together 6 tools. We built ours for design/marketing agencies.',
        82,
        '{"intent_strength":16,"budget_indicators":13,"decision_maker_likely":18,"fit_with_aventis":17,"east_coast_bonus":18,"reasoning":"Active buying mode, perfect product fit"}'::jsonb,
        'new', false, now() - interval '7 hours'
      ),
      (
        'sample:producthunt-001', 'producthunt',
        'https://www.producthunt.com/posts/example-product',
        'ZenFlow — AI-powered task manager that prioritizes your day. We just launched on ProductHunt! Solo founder in Miami. Looking for our first 1000 users.',
        now() - interval '6 hours',
        'Carlos Mendez', 'ZenFlow', NULL, 'https://getzenflow.example.com',
        'Miami, FL', 'FL', true,
        'Productivity SaaS', 'solo founder',
        ARRAY['just launched', 'looking for users'],
        'Just launched on ProductHunt! Solo founder in Miami. Looking for our first 1000 users.',
        'launching', 'completed',
        'Solo founder in Miami, FL launching productivity SaaS on ProductHunt. Active need for users + growth marketing. Limited budget likely.',
        ARRAY['No customer acquisition channel', 'Solo founder bandwidth', 'PH traffic spike is temporary'],
        ARRAY['Just launched (active phase)', 'Miami = East Coast', 'Solo = decision maker'],
        ARRAY['AventisAI tools (low-cost entry)', 'PH launch consulting', 'Initial content + SEO'],
        'Carlos — saw ZenFlow on PH today. The 7 days after launch are the most important. Free 15-min call if useful?',
        72,
        '{"intent_strength":13,"budget_indicators":8,"decision_maker_likely":20,"fit_with_aventis":13,"east_coast_bonus":18,"reasoning":"Strong intent but limited budget"}'::jsonb,
        'new', false, now() - interval '5 hours'
      ),
      (
        'sample:devto-001', 'devto',
        'https://dev.to/example/article-12345',
        'Just launched my SaaS after 8 months of nights and weekends. ClientFlow.io — invoicing for consultants. Boston-based. Need to figure out marketing now that the product is shipped.',
        now() - interval '18 hours',
        'Raj Patel', 'ClientFlow', NULL, 'https://clientflow.example.com',
        'Boston, MA', 'MA', true,
        'B2B SaaS / Invoicing', 'solo founder',
        ARRAY['just launched', 'need to figure out marketing'],
        'Just launched my SaaS after 8 months — need to figure out marketing now',
        'launching', 'completed',
        'Solo technical founder in Boston, MA. Just launched B2B SaaS for consultants. Explicitly says "need to figure out marketing now". Decision-maker, East Coast.',
        ARRAY['No marketing skills (technical founder)', 'No customers yet', 'Boston B2B market is competitive'],
        ARRAY['Just shipped (urgency)', 'Boston East Coast', 'Solo founder = decision maker', 'Targets consultants (B2B)'],
        ARRAY['Foundational marketing setup (positioning, ICP, channels)', 'AventisAI content marketing', 'Cold outreach playbook for B2B'],
        'Raj — saw your launch post on DEV. The 30 days after launch are critical. I help technical founders with the marketing they don''t want to think about.',
        80,
        '{"intent_strength":17,"budget_indicators":11,"decision_maker_likely":20,"fit_with_aventis":15,"east_coast_bonus":18,"reasoning":"Explicit ask, founder, East Coast"}'::jsonb,
        'new', false, now() - interval '17 hours'
      )
      ON CONFLICT (external_id) DO NOTHING
    `;

    // Add a sample generation_run so dashboard cycle history isn't empty
    await sql`
      INSERT INTO generation_runs (
        started_at, completed_at, status, sources_attempted, sources_succeeded,
        raw_signals_found, leads_created, leads_researched, leads_qualified, notification_sent
      ) VALUES (
        now() - interval '30 minutes',
        now() - interval '28 minutes',
        'completed',
        ARRAY['reddit','hackernews','google','twitter','indeed','producthunt','indiehackers','businessregistry','bluesky','github','stackexchange','devto','lobsters','ycombinator'],
        ARRAY['reddit','hackernews','indiehackers','bluesky','github','stackexchange','devto','lobsters','ycombinator','businessregistry'],
        47, 10, 10, 8, true
      )
    `;

    // Add a research activity on the top lead so its timeline isn't empty
    await sql`
      INSERT INTO lead_activities (lead_id, type, title, content, created_by)
      SELECT id, 'research_update', 'Initial AI research completed', research_summary, 'system'
      FROM leads WHERE external_id = 'sample:reddit-001'
    `;

    await log("info", "seed_complete", "Inserted 10 sample leads + 1 sample run");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("error", "seed_failed", msg);
    return false;
  }
}
