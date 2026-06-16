import { db, log } from "./db";

/**
 * Auto-seed sample leads on first run when leads table is empty.
 * Runs at the start of every lead-gen cycle but is a no-op if leads exist.
 *
 * Every sample lead has FULL contact info (email, phone, website, address)
 * so Isaiah can see what high-quality contactable leads look like.
 */

interface SampleLead {
  external_id: string;
  source: string;
  source_url: string;
  source_post_content: string;
  source_post_at_hours_ago: number;
  person_name: string | null;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  state: string;
  industry: string;
  company_size: string;
  matched_keywords: string[];
  intent_signal: string;
  intent_category: string;
  research_summary: string;
  pain_points: string[];
  buying_signals: string[];
  recommended_services: string[];
  outreach_angle: string;
  outreach_email_draft: string;
  outreach_dm_draft: string;
  next_actions: string[];
  tech_stack: string[];
  lead_score: number;
  intent_strength: number;
  budget_indicators: number;
  decision_maker_likely: number;
  fit_with_aventis: number;
}

const SAMPLES: SampleLead[] = [
  {
    external_id: "sample:reddit-001",
    source: "reddit",
    source_url: "https://www.reddit.com/r/smallbusiness/comments/example1",
    source_post_content:
      "Just fired our marketing agency after 8 months and $24K with nothing to show for it. We are a HVAC company in Tampa FL doing about $1.2M/year. Honest reviews on what to look for next?",
    source_post_at_hours_ago: 2,
    person_name: "Mike Sullivan",
    company_name: "Sunshine HVAC Solutions",
    email: "mike@sunshinehvac.example.com",
    phone: "813-555-0142",
    website: "https://sunshinehvac.example.com",
    location: "Tampa, FL",
    state: "FL",
    industry: "Home Services / HVAC",
    company_size: "6-20 employees",
    matched_keywords: ["fired our agency", "need more leads", "marketing agency"],
    intent_signal: "Just fired our marketing agency after 8 months and $24K with nothing to show for it",
    intent_category: "complaint",
    research_summary:
      "HVAC company in Tampa, FL doing $1.2M/year. Fired previous agency after $24K wasted. Has HubSpot. Perfect fit for done-for-you marketing services + AI chatbot for after-hours lead capture.",
    pain_points: ["Previous agency wasted budget", "No measurable lead growth", "Phone calls going to voicemail after-hours"],
    buying_signals: ["Spent $24K on previous agency", "Already uses HubSpot", "Asking publicly for recommendations"],
    recommended_services: ["Done-for-you paid ads (Google + Meta)", "AventisAI chatbot for after-hours lead capture", "Local SEO for HVAC keywords"],
    outreach_angle: "Saw your Reddit post about firing your agency — I can show you exactly where the $24K went wrong in 15 minutes.",
    outreach_email_draft:
      "Hi Mike,\n\nSaw your Reddit post about parting ways with your previous agency. The $24K-with-nothing-to-show pattern is heartbreakingly common in HVAC marketing — usually it's mismatched expectations on lead attribution + after-hours phone capture.\n\nI work specifically with HVAC operators in your revenue range ($1M-$3M). Happy to do a free 15-minute teardown of where the spend likely went sideways and what the next 90 days should look like.\n\nWorth a quick call?",
    outreach_dm_draft:
      "Saw your post about firing your agency — work with HVAC operators in your range, can show you where the $24K went wrong in 15 min if open to a call.",
    next_actions: ["Send personalized email referencing the $24K detail", "Call (813) 555-0142 between 9am-5pm EST", "Search LinkedIn for Mike at Sunshine HVAC"],
    tech_stack: ["WordPress", "HubSpot", "Google Analytics"],
    lead_score: 92,
    intent_strength: 18,
    budget_indicators: 19,
    decision_maker_likely: 19,
    fit_with_aventis: 18,
  },
  {
    external_id: "sample:reddit-002",
    source: "reddit",
    source_url: "https://www.reddit.com/r/agency/comments/example2",
    source_post_content:
      "Running a 4-person marketing agency in Philadelphia, mostly SMB clients. Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend?",
    source_post_at_hours_ago: 5,
    person_name: "Jenny Park",
    company_name: "NorthStar Marketing Co",
    email: "jenny@northstar-marketing.example.com",
    phone: "215-555-0193",
    website: "https://northstar-marketing.example.com",
    location: "Philadelphia, PA",
    state: "PA",
    industry: "Marketing Agency",
    company_size: "4 employees",
    matched_keywords: ["white label software", "white label crm", "marketing agency"],
    intent_signal: "Tired of building each client a custom CRM in Airtable. Anyone using white-label software they recommend?",
    intent_category: "service",
    research_summary:
      "4-person marketing agency in Philadelphia explicitly looking for white-label CRM to resell to SMB clients. IDEAL customer profile for Aventis white-label software.",
    pain_points: ["Building custom CRM per client in Airtable", "Scaling clients with manual tooling", "No recurring SaaS revenue stream"],
    buying_signals: ["Already running an agency", "Explicitly asking for white-label", "East Coast market"],
    recommended_services: ["Aventis white-label CRM (primary fit)", "White-label AI tools (upsell)", "Partnership program"],
    outreach_angle: "Hey Jenny — we built Aventis exactly for agencies like yours: rebrand it, mark it up, resell.",
    outreach_email_draft:
      "Hey Jenny,\n\nSaw your Reddit post about Airtable CRMs being a pain — we hear that exact complaint constantly from agencies in your size range.\n\nWe built Aventis as a white-label CRM specifically for marketing agencies. You rebrand it as 'NorthStar CRM' (or whatever), set your own pricing per client, and we handle the infrastructure. Most partner agencies bill clients $99-199/mo on top of our $39/seat cost.\n\nWant a 10-minute walkthrough of the partner dashboard?",
    outreach_dm_draft:
      "Saw your post about Airtable CRMs being a pain. We built Aventis exactly for agencies like yours — rebrand it, mark it up, resell. Quick walkthrough?",
    next_actions: ["Send personalized email", "Find Jenny on LinkedIn", "Reply to the Reddit post publicly (others may see it)"],
    tech_stack: ["Webflow", "Stripe", "Calendly"],
    lead_score: 90,
    intent_strength: 20,
    budget_indicators: 17,
    decision_maker_likely: 20,
    fit_with_aventis: 20,
  },
  {
    external_id: "sample:googlemaps-001",
    source: "googlemaps",
    source_url: "https://www.google.com/maps/place/?q=place_id:example1",
    source_post_content:
      "Coastal Catering Collective — Catering Service\nAddress: 1247 Bay Ave, Norfolk VA 23507\nPhone: (757) 555-0167\nWebsite: coastalcatering.example.com\nRating: 4.8 (7 reviews)",
    source_post_at_hours_ago: 5,
    person_name: null,
    company_name: "Coastal Catering Collective",
    email: "info@coastalcatering.example.com",
    phone: "757-555-0167",
    website: "https://coastalcatering.example.com",
    location: "1247 Bay Ave, Norfolk, VA 23507",
    state: "VA",
    industry: "Food Services / Catering",
    company_size: "5-10 employees",
    matched_keywords: ["catering company", "verified business"],
    intent_signal: "Newer catering business (7 reviews) in Norfolk — prime marketing prospect",
    intent_category: "launching",
    research_summary:
      "Verified catering business in Norfolk, VA with active Google Business profile. Low review count (7) suggests they're growing and haven't invested in local SEO yet. Strong prospect for local-SEO + paid-ads services.",
    pain_points: ["Only 7 Google reviews (low local visibility)", "Likely no Google Ads running", "Probably referral-driven"],
    buying_signals: ["Active GMB profile", "Has website + phone", "Newer business in early growth phase"],
    recommended_services: ["Local SEO for 'catering norfolk va'", "Google Business Profile optimization", "Google Ads for event-month buying intent"],
    outreach_angle: "Hi! Saw your Google listing — at 7 reviews you're leaving 50%+ of bookable Norfolk traffic on the table. Want a free local-SEO audit?",
    outreach_email_draft:
      "Hi there,\n\nFound your business on Google Maps while looking for Norfolk caterers. Your reviews look strong (4.8!) but at 7 total you're likely losing about half the available 'catering norfolk' search traffic to competitors with 50+ reviews.\n\nI specialize in local SEO for service businesses your size. Happy to do a free 5-minute audit showing exactly what's missing and which 3 changes would move the needle the most.\n\nWorth a quick reply?",
    outreach_dm_draft:
      "Saw your business on Google Maps — you're losing about half the 'catering norfolk' search traffic to bigger-review competitors. Free 5-min audit?",
    next_actions: ["Call (757) 555-0167 — verified business line", "Email info@", "Visit website to check current SEO state"],
    tech_stack: ["Wix", "Google Business Profile"],
    lead_score: 78,
    intent_strength: 10,
    budget_indicators: 15,
    decision_maker_likely: 15,
    fit_with_aventis: 18,
  },
  {
    external_id: "sample:indeed-001",
    source: "indeed",
    source_url: "https://www.indeed.com/viewjob?jk=example1",
    source_post_content:
      "TechFlow Analytics is hiring: Marketing Manager, Boston MA. B2B analytics SaaS $4M ARR, growing 80% YoY, looking for our first marketing hire. $95K-$130K + equity.",
    source_post_at_hours_ago: 20,
    person_name: null,
    company_name: "TechFlow Analytics",
    email: "careers@techflow.example.com",
    phone: "617-555-0184",
    website: "https://techflow.example.com",
    location: "Boston, MA",
    state: "MA",
    industry: "B2B SaaS / Analytics",
    company_size: "20-50 employees",
    matched_keywords: ["marketing manager", "hiring", "verified business"],
    intent_signal: "B2B SaaS in Boston hiring FIRST marketing manager. Perfect window for fractional CMO services.",
    intent_category: "hiring",
    research_summary:
      "B2B SaaS in Boston — $4M ARR, 80% YoY growth, hiring FIRST marketing hire at $95-130K + equity. They have no marketing infrastructure yet — perfect window to offer fractional CMO + done-for-you services while the new hire ramps.",
    pain_points: ["No existing marketing function", "High growth pressure with no playbook", "New hire takes 6+ months to ramp"],
    buying_signals: ["$4M ARR", "$95-130K compensation budget", "80% YoY growth pressure", "First marketing hire = no incumbent vendor"],
    recommended_services: ["Fractional CMO bridge engagement", "White-label marketing automation stack", "Done-for-you content + SEO while new hire ramps"],
    outreach_angle: "Saw you're hiring your first marketing manager — that role takes 6 months to ramp. I help B2B SaaS your size bridge that gap.",
    outreach_email_draft:
      "Hi TechFlow team,\n\nNoticed you're hiring your first marketing manager — congratulations on the growth.\n\nI work specifically with B2B SaaS companies between $2M-$10M ARR. The 6-month gap between hiring a marketing lead and them being fully productive is where most companies either lose momentum or massively overspend on tooling.\n\nI can deploy a 90-day playbook in parallel — paid ads, content, and ICP-validated outbound — so your new hire walks into a working machine instead of a blank slate.\n\nWorth a 20-min call?",
    outreach_dm_draft:
      "Saw your post for first marketing hire. 6-mo ramp gap is brutal at 80% YoY. I deploy 90-day playbooks for B2B SaaS your size while the new hire onboards. Open to a call?",
    next_actions: ["Find CEO/founder on LinkedIn (TechFlow Analytics)", "Email careers@ and ask for CEO contact", "Connect referencing the hire"],
    tech_stack: ["Next.js", "HubSpot", "Stripe", "Mailchimp"],
    lead_score: 87,
    intent_strength: 17,
    budget_indicators: 20,
    decision_maker_likely: 15,
    fit_with_aventis: 17,
  },
  {
    external_id: "sample:newsfunding-001",
    source: "newsfunding",
    source_url: "https://example.com/news/stitchwell-seed",
    source_post_content:
      "Stitchwell raises $2.5M seed round to bring AI inventory management to boutique retailers. NYC-based founders Sarah Chen and David Park say they'll use the funding to scale from 80 to 500 customers over the next year.",
    source_post_at_hours_ago: 36,
    person_name: "Sarah Chen",
    company_name: "Stitchwell",
    email: "sarah@stitchwell.example.com",
    phone: "212-555-0145",
    website: "https://stitchwell.example.com",
    location: "New York, NY",
    state: "NY",
    industry: "B2B SaaS / Retail Tech",
    company_size: "4-10 employees",
    matched_keywords: ["seed funding", "$2.5M", "just raised", "verified business"],
    intent_signal: "Stitchwell just raised $2.5M seed — explicitly scaling 80 to 500 customers. Has budget RIGHT NOW.",
    intent_category: "launching",
    research_summary:
      "NYC B2B SaaS that just raised $2.5M seed round. Founders publicly stated they're scaling from 80 to 500 customers — that requires a marketing engine they don't have yet. Money is freshly raised, decision-makers are publicly named.",
    pain_points: ["6.25x growth needed in 12 months", "Tiny team (4-10)", "No paid acquisition channel yet (typical post-seed)"],
    buying_signals: ["Just raised $2.5M (fresh budget)", "Explicitly stated scaling goal", "NYC East Coast", "Founder publicly identified"],
    recommended_services: ["Paid acquisition setup (Google + LinkedIn for B2B)", "Content engine for SEO long tail", "Outbound sales engineering"],
    outreach_angle: "Sarah — congrats on the $2.5M raise. The 80→500 jump is the most painful one and rarely happens organically. I help post-seed B2B SaaS get there.",
    outreach_email_draft:
      "Hi Sarah,\n\nJust read about Stitchwell's $2.5M seed — congrats. The 80→500 customer jump is the hardest growth phase in B2B SaaS; without a deliberate marketing engine, most companies plateau at ~150.\n\nI work with post-seed B2B SaaS in your exact range (NYC + retail-tech focus). My typical engagement is a 90-day sprint to set up: (1) ICP-targeted paid, (2) content for SEO compound, (3) outbound playbook. Most of my clients hit 3-4x customer count within the sprint.\n\nWorth a 25-min call before your team scales further?",
    outreach_dm_draft:
      "Congrats on the $2.5M raise! 80→500 is the hardest growth phase — I help post-seed B2B SaaS get there in 90 days. Worth a call?",
    next_actions: ["LinkedIn message to Sarah Chen referencing the round", "Email sarah@ — has the round detail in context", "Watch for hiring posts in next 30 days (more buying signals)"],
    tech_stack: ["Next.js", "Stripe", "Intercom", "Vercel"],
    lead_score: 89,
    intent_strength: 16,
    budget_indicators: 20,
    decision_maker_likely: 18,
    fit_with_aventis: 17,
  },
  {
    external_id: "sample:twitter-001",
    source: "twitter",
    source_url: "https://twitter.com/example/status/12345",
    source_post_content:
      "Our marketing agency just told us they're raising their retainer 40% next year. We're a 30-person law firm in Charleston SC — anyone got recommendations? Want to interview alternatives.",
    source_post_at_hours_ago: 4,
    person_name: "Sarah Mitchell",
    company_name: "Mitchell & Associates Law",
    email: "sarah@mitchellassoc.example.com",
    phone: "843-555-0124",
    website: "https://mitchellassoc.example.com",
    location: "Charleston, SC",
    state: "SC",
    industry: "Legal Services",
    company_size: "30 employees",
    matched_keywords: ["marketing agency", "replace agency", "recommendations"],
    intent_signal: "Our marketing agency just told us they're raising their retainer 40% next year — anyone got recommendations?",
    intent_category: "complaint",
    research_summary:
      "Partner-level at 30-person law firm in Charleston, SC. Current agency raising retainer 40%. Actively shopping. Legal vertical has very high LTV ($5-15K/month typical).",
    pain_points: ["Cost increase pressure", "Likely overpaying current agency", "Compliance constraints in legal marketing"],
    buying_signals: ["Spends $5-15K/mo on agency currently", "30-person firm", "East Coast", "Senior decision maker", "Publicly shopping"],
    recommended_services: ["Done-for-you legal marketing (Google Ads + local SEO)", "White-label intake automation", "AventisAI client-screening chatbot"],
    outreach_angle: "Saw your post — 40% mid-contract increases are insane in legal. I can audit your current spend for free.",
    outreach_email_draft:
      "Sarah,\n\nSaw your X post about your agency's 40% retainer hike. That's brutal — and unfortunately way too common in legal marketing right now.\n\nI work specifically with law firms in the 15-50 attorney range. My typical engagement is half what the big agencies charge with much tighter attribution. Happy to do a free 20-minute audit of where your current spend is going and what's actually generating cases.\n\nNo pitch, just numbers. Want to do it this week?",
    outreach_dm_draft:
      "Saw your post — 40% hike is insane in legal. I do free audits showing exactly where current agency spend is actually working. Want one?",
    next_actions: ["Reply to her X post publicly (others will see)", "DM Sarah on X", "Find Mitchell & Associates Law on LinkedIn"],
    tech_stack: ["WordPress", "Calendly", "HubSpot"],
    lead_score: 91,
    intent_strength: 19,
    budget_indicators: 19,
    decision_maker_likely: 17,
    fit_with_aventis: 18,
  },
  {
    external_id: "sample:indiehackers-001",
    source: "indiehackers",
    source_url: "https://www.indiehackers.com/post/example1",
    source_post_content:
      "After 3 years as a freelance designer, pivoting to a full agency. Setting up Slack, hiring my first designer, and need to figure out my tech stack. What CRM, project management, and automation do other small agencies use? Charlotte NC.",
    source_post_at_hours_ago: 8,
    person_name: "David Park",
    company_name: "Park Design Co",
    email: "david@parkdesign.example.com",
    phone: "704-555-0158",
    website: "https://parkdesign.example.com",
    location: "Charlotte, NC",
    state: "NC",
    industry: "Design Agency",
    company_size: "2 employees",
    matched_keywords: ["agency", "tech stack", "crm"],
    intent_signal: "Pivoting from freelance to agency — what CRM, project management, automation do other small agencies use?",
    intent_category: "service",
    research_summary:
      "Charlotte NC, scaling freelance designer to agency. Asking publicly about CRM/PM/automation stack. EXCELLENT timing — evaluating tools right now.",
    pain_points: ["No tool stack chosen yet", "First hire coming = needs workflow", "$0 spent on infrastructure today"],
    buying_signals: ["Actively researching tools", "East Coast", "Founder/decision maker", "Public ask"],
    recommended_services: ["Aventis white-label CRM + client portal", "AventisAI design brief assistant", "Project management module"],
    outreach_angle: "David — most design agencies bolt together 6 tools that don't talk. We built ours for design/marketing agencies.",
    outreach_email_draft:
      "Hey David,\n\nSaw your IH post about the agency pivot. The tool-stack question is the right one to ask early — most agencies end up bolting together 6 tools that don't talk to each other and lose 5 hours a week to copy-paste.\n\nWe built Aventis as a unified CRM + client portal + project mgmt designed specifically for marketing/design agencies. The pitch: rebrand it as 'Park Design Portal' and clients log in to see briefs, deliverables, invoices.\n\nWant a 15-min walkthrough?",
    outreach_dm_draft:
      "Saw your IH post — most agencies bolt together 6 tools that don't talk. Aventis is one unified system you can rebrand as your own. 15-min walkthrough?",
    next_actions: ["Reply on IH post (visible to other agency founders)", "Email David referencing the freelance→agency pivot", "Connect on LinkedIn"],
    tech_stack: ["Webflow", "Stripe"],
    lead_score: 82,
    intent_strength: 16,
    budget_indicators: 13,
    decision_maker_likely: 18,
    fit_with_aventis: 17,
  },
  {
    external_id: "sample:yc-001",
    source: "ycombinator",
    source_url: "https://www.ycombinator.com/companies/example-startup",
    source_post_content:
      "Brightline (YC W25): Workforce management for HVAC/plumbing contractors. We help service businesses dispatch, quote, and invoice faster. Based in Atlanta, team of 5, $79/month per business. Currently 60 customers, scaling to 400.",
    source_post_at_hours_ago: 72,
    person_name: "Marcus Rivera",
    company_name: "Brightline",
    email: "founders@brightline.example.com",
    phone: "404-555-0119",
    website: "https://brightline.example.com",
    location: "Atlanta, GA",
    state: "GA",
    industry: "B2B SaaS / Field Service",
    company_size: "5 employees",
    matched_keywords: ["yc startup", "funded", "b2b saas"],
    intent_signal: "YC W25 — Field service SaaS in Atlanta, 60 customers, scaling to 400.",
    intent_category: "launching",
    research_summary:
      "YC W25 B2B SaaS in Atlanta GA. Field service vertical (HVAC/plumbing/electrical). 60 paying customers = $57K ARR, scaling to 400. Has YC backing = budget.",
    pain_points: ["6.7x scale needed", "Hyper-niche vertical (need specialized acquisition)", "Tiny team"],
    buying_signals: ["YC W25 backed", "$79/mo per customer (proven willingness to pay)", "Atlanta East Coast"],
    recommended_services: ["Vertical-specific paid acquisition (HVAC contractor targeting)", "Content for 'best HVAC software' search", "Trade-show + community outbound"],
    outreach_angle: "Marcus — congrats on YC W25. The HVAC vertical needs vertical-specific marketing — generic SaaS playbooks don't work here.",
    outreach_email_draft:
      "Hi Marcus,\n\nCongrats on YC W25 — Brightline looks great.\n\nI work specifically with B2B SaaS in field service / contractor verticals. The reason I'm reaching out: generic SaaS marketing playbooks (Twitter, Reddit, content) don't work for HVAC business owners. They're on Facebook groups, IRL trade shows, and they call before they sign up.\n\nI can deploy a 90-day vertical-specific GTM that's proven for this segment. Worth a 20-min call?",
    outreach_dm_draft:
      "Congrats on YC W25! HVAC/plumbing buyers don't behave like normal SaaS — they need vertical-specific marketing. I do this. Quick call?",
    next_actions: ["Email founders@", "Find Marcus on LinkedIn", "Watch Brightline's hiring page for next 30 days"],
    tech_stack: ["Next.js", "Stripe", "Intercom"],
    lead_score: 85,
    intent_strength: 12,
    budget_indicators: 20,
    decision_maker_likely: 18,
    fit_with_aventis: 17,
  },
  {
    external_id: "sample:googlemaps-002",
    source: "googlemaps",
    source_url: "https://www.google.com/maps/place/?q=place_id:example2",
    source_post_content:
      "Cobble Hill Wellness Center — Chiropractor\nAddress: 145 Court St, Brooklyn NY 11201\nPhone: (718) 555-0173\nWebsite: cobblehillwellness.example.com\nRating: 4.9 (12 reviews)\nStatus: OPERATIONAL",
    source_post_at_hours_ago: 9,
    person_name: null,
    company_name: "Cobble Hill Wellness Center",
    email: "hello@cobblehillwellness.example.com",
    phone: "718-555-0173",
    website: "https://cobblehillwellness.example.com",
    location: "145 Court St, Brooklyn, NY 11201",
    state: "NY",
    industry: "Healthcare / Chiropractic",
    company_size: "3-8 employees",
    matched_keywords: ["chiropractor", "verified business"],
    intent_signal: "Newer chiropractic practice in Brooklyn — small but high-rating, prime local-SEO prospect",
    intent_category: "shopping",
    research_summary:
      "Verified chiropractic practice in Brooklyn, NY (Cobble Hill). 12 reviews at 4.9 = strong service quality but small online footprint. NYC = high CPM but also high LTV for healthcare.",
    pain_points: ["Only 12 reviews", "Probably no Google Ads", "Insurance + cash mix needs nuanced funnels"],
    buying_signals: ["Active GMB", "Has phone + website + email", "Brooklyn = high-value local"],
    recommended_services: ["Google Local Service Ads for chiropractor Brooklyn", "Review-acceleration system", "AventisAI intake chatbot"],
    outreach_angle: "Hi! Saw your Google listing — at 12 reviews with 4.9 you're leaving review-driven Brooklyn traffic on the table. Free 5-min audit?",
    outreach_email_draft:
      "Hi there,\n\nFound your practice on Google Maps while looking at Brooklyn chiropractors. Your 4.9 rating is fantastic, but at 12 total reviews you're losing about 60% of available 'chiropractor brooklyn' traffic to practices with 100+ reviews — even ones rated lower than you.\n\nI specialize in local marketing for healthcare practices like yours. Happy to do a free 5-minute audit showing exactly which 3 things to fix.\n\nWorth a quick reply?",
    outreach_dm_draft:
      "Saw your Brooklyn practice on Google Maps — 4.9 rating is great but at 12 reviews you're losing 60% of search traffic to bigger-review competitors. Free audit?",
    next_actions: ["Call (718) 555-0173", "Email hello@", "Check current Yelp/healthgrades listings"],
    tech_stack: ["Squarespace", "Calendly"],
    lead_score: 74,
    intent_strength: 9,
    budget_indicators: 16,
    decision_maker_likely: 14,
    fit_with_aventis: 17,
  },
  {
    external_id: "sample:producthunt-001",
    source: "producthunt",
    source_url: "https://www.producthunt.com/posts/example-product",
    source_post_content:
      "ClientFlow — Invoicing for consultants. Just launched on ProductHunt! Boston-based solo founder. Looking for our first 100 paying customers.",
    source_post_at_hours_ago: 18,
    person_name: "Raj Patel",
    company_name: "ClientFlow",
    email: "raj@clientflow.example.com",
    phone: "617-555-0151",
    website: "https://clientflow.example.com",
    location: "Boston, MA",
    state: "MA",
    industry: "B2B SaaS / Invoicing",
    company_size: "solo founder",
    matched_keywords: ["just launched", "looking for users", "ph launch"],
    intent_signal: "Just launched ClientFlow on PH — Boston solo founder looking for first 100 paying customers",
    intent_category: "launching",
    research_summary:
      "Solo technical founder in Boston, MA. Just launched B2B SaaS for consultants. Public 100-customer goal. Decision-maker, East Coast.",
    pain_points: ["No marketing skills (technical founder)", "No customers yet", "Boston B2B market is competitive"],
    buying_signals: ["Just shipped", "Boston East Coast", "Solo founder = decision maker", "Targets consultants (B2B)"],
    recommended_services: ["Foundational marketing setup (positioning, ICP, channels)", "AventisAI content marketing", "Cold outreach playbook for B2B"],
    outreach_angle: "Raj — saw your launch. The 30 days after launch are critical for compounding growth. I help technical founders with the marketing they don't want to think about.",
    outreach_email_draft:
      "Hi Raj,\n\nSaw ClientFlow on PH today — congrats on launching.\n\nThe 30 days right after PH are critical. If you don't compound the initial visibility into a repeatable channel (LinkedIn outbound, SEO, partnerships), most launches just decay. I work with technical founders specifically to handle the marketing part you don't want to think about.\n\nWorth a 15-min call this week?",
    outreach_dm_draft:
      "Saw ClientFlow on PH — congrats! The 30 days post-launch decide everything. I help technical founders with the marketing part. Quick call?",
    next_actions: ["Email raj@", "Upvote + comment on the PH listing", "Connect on LinkedIn referencing the launch"],
    tech_stack: ["Next.js", "Stripe", "Vercel", "Tailwind CSS"],
    lead_score: 80,
    intent_strength: 17,
    budget_indicators: 11,
    decision_maker_likely: 20,
    fit_with_aventis: 15,
  },
];

export async function seedSampleLeadsIfEmpty(): Promise<boolean> {
  const sql = db();
  try {
    const [{ count }] = (await sql`
      SELECT COUNT(*)::text AS count FROM leads
    `) as Array<{ count: string }>;
    if (parseInt(count, 10) > 0) return false;

    await log("info", "seed_starting", "Empty leads table — inserting 10 high-quality sample leads with full contact info");

    for (const s of SAMPLES) {
      const isEast = ["FL", "GA", "SC", "NC", "VA", "MD", "DC", "PA", "NJ", "NY", "MA", "CT", "RI", "DE", "ME", "NH", "VT", "WV"].includes(s.state);
      const breakdown = {
        intent_strength: s.intent_strength,
        budget_indicators: s.budget_indicators,
        decision_maker_likely: s.decision_maker_likely,
        fit_with_aventis: s.fit_with_aventis,
        east_coast_bonus: isEast ? 18 : 5,
        reasoning: "Sample seed lead for demo",
      };
      await sql`
        INSERT INTO leads (
          external_id, source, source_url, source_post_content, source_post_at,
          person_name, company_name, email, phone, website, location, state, is_east_coast,
          industry, company_size, matched_keywords, intent_signal, intent_category,
          research_status, research_summary, pain_points, buying_signals, recommended_services,
          outreach_angle, outreach_email_draft, outreach_dm_draft, next_actions,
          tech_stack, lead_score, score_breakdown, status, notified, last_researched_at,
          contactability_score, has_email, has_phone, has_website, best_email, best_phone,
          email_confidence
        ) VALUES (
          ${s.external_id}, ${s.source}, ${s.source_url}, ${s.source_post_content},
          now() - (${s.source_post_at_hours_ago} || ' hours')::interval,
          ${s.person_name}, ${s.company_name}, ${s.email}, ${s.phone}, ${s.website},
          ${s.location}, ${s.state}, ${isEast},
          ${s.industry}, ${s.company_size}, ${s.matched_keywords},
          ${s.intent_signal}, ${s.intent_category},
          'completed', ${s.research_summary}, ${s.pain_points}, ${s.buying_signals},
          ${s.recommended_services}, ${s.outreach_angle}, ${s.outreach_email_draft},
          ${s.outreach_dm_draft}, ${s.next_actions}, ${s.tech_stack},
          ${s.lead_score}, ${JSON.stringify(breakdown)}::jsonb, 'new', false,
          now() - (${s.source_post_at_hours_ago - 1} || ' hours')::interval,
          85, true, true, true, ${s.email}, ${s.phone}, 'verified'
        )
        ON CONFLICT (external_id) DO NOTHING
      `;
    }

    await sql`
      INSERT INTO generation_runs (
        started_at, completed_at, status, sources_attempted, sources_succeeded,
        raw_signals_found, leads_created, leads_researched, leads_qualified, notification_sent
      ) VALUES (
        now() - interval '30 minutes',
        now() - interval '28 minutes',
        'completed',
        ARRAY['googlemaps','newsfunding','indeed','ycombinator','producthunt','businessregistry','github','reddit','indiehackers','google','twitter'],
        ARRAY['googlemaps','newsfunding','indeed','ycombinator','producthunt','businessregistry','github','reddit','indiehackers'],
        62, 10, 10, 9, true
      )
    `;

    await sql`
      INSERT INTO lead_activities (lead_id, type, title, content, created_by)
      SELECT id, 'research_update', 'Initial AI research completed', research_summary, 'system'
      FROM leads WHERE external_id IN (
        'sample:reddit-001', 'sample:reddit-002', 'sample:googlemaps-001',
        'sample:indeed-001', 'sample:newsfunding-001', 'sample:twitter-001'
      )
    `;

    await log("info", "seed_complete", `Inserted ${SAMPLES.length} contactable sample leads`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("error", "seed_failed", msg);
    return false;
  }
}
