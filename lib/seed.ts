import { db, log } from "./db";

/**
 * Sample leads seeded on first run when the leads table is empty.
 *
 * v4: every sample is JUNK REMOVAL or REAL ESTATE, East Coast, with a full
 * contact set (email + phone + website + address + coordinates) plus
 * ready-to-send email, DM, and cold-call scripts.
 */

interface SampleLead {
  external_id: string;
  source: string;
  source_url: string;
  source_post_content: string;
  hours_ago: number;
  vertical: "junk_removal" | "real_estate";
  person_name: string | null;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  state: string;
  latitude: number;
  longitude: number;
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
  outreach_phone_script: string;
  next_actions: string[];
  tech_stack: string[];
  services_offered: string[];
  uses_lead_marketplace: boolean;
  estimated_monthly_value: number;
  lead_score: number;
  intent_strength: number;
  budget_indicators: number;
  decision_maker_likely: number;
  vertical_fit: number;
}

const SAMPLES: SampleLead[] = [
  {
    external_id: "sample:reddit-junk-001",
    source: "reddit",
    source_url: "https://www.reddit.com/r/junkremoval/comments/example1",
    source_post_content:
      "Been running my junk removal business in Tampa for 3 years, 2 trucks. Angi is killing me — $70 a lead and they sell the same lead to 4 other companies. I'm closing maybe 1 in 5. Spent $3,100 last month for 11 jobs. There has to be a better way to get customers. Anyone actually making Google Ads work for junk removal?",
    hours_ago: 3,
    vertical: "junk_removal",
    person_name: "Marcus Bell",
    company_name: "Bay Area Junk Pros",
    email: "marcus@bayareajunkpros.example.com",
    phone: "813-555-0142",
    website: "https://bayareajunkpros.example.com",
    location: "4412 W Kennedy Blvd, Tampa, FL 33609",
    state: "FL",
    latitude: 27.9447,
    longitude: -82.5099,
    industry: "Junk Removal & Hauling",
    company_size: "2 trucks, 4 employees",
    matched_keywords: ["junk removal", "angi leads", "cost per lead too high", "need more leads"],
    intent_signal:
      "Angi is killing me — $70 a lead and they sell the same lead to 4 other companies. Spent $3,100 last month for 11 jobs.",
    intent_category: "pain",
    research_summary:
      "Tampa junk removal operator with 2 trucks, 3 years in business. Publicly stated they spent $3,100 on Angi last month for only 11 booked jobs — that's a $282 cost-per-booked-job, roughly 2x what it should be. He's explicitly asking whether Google Ads works for junk removal, which is exactly the conversation we want to have. Site is Wix with no online booking form and no Google Ads pixel, so he's not running paid search at all yet. Proven budget, clear pain, decision maker, East Coast.",
    pain_points: [
      "$282 effective cost per booked job through Angi (2x industry benchmark)",
      "Shared leads sold to 4 competitors — 20% close rate",
      "No owned lead channel; entirely dependent on marketplace",
      "Wix site has no booking form — friction on every inbound",
    ],
    buying_signals: [
      "Already spending $3,100/month on lead acquisition (budget proven)",
      "Publicly asking about Google Ads for junk removal",
      "3 years in business with 2 trucks = past survival stage",
      "Tampa market is large enough to support paid search",
    ],
    recommended_services: [
      "Google Local Services Ads — pay-per-lead at roughly 1/3 of Angi's effective cost",
      "Local SEO for 'junk removal tampa' to own the map pack",
      "AventisAI phone agent so crew-on-site calls stop going to voicemail",
      "Review-acceleration system (reviews drive the map pack)",
    ],
    outreach_angle:
      "You're paying $282 per booked job through Angi. LSA in Tampa runs $45-70 per booked job. That gap is your entire profit margin.",
    outreach_email_draft:
      "Marcus,\n\nSaw your post about Angi — $3,100 for 11 jobs works out to about $282 per booked job. For comparison, Google Local Services Ads in the Tampa market typically runs $45-70 per booked job, and those leads aren't shared with four competitors.\n\nThe reason most junk removal guys can't make Google Ads work is they run standard search ads instead of LSA, and they don't have call capture set up, so half the leads hit voicemail while crews are on site.\n\nI set this up for junk removal operators specifically. Happy to walk you through the exact LSA setup on a 15-minute call — no pitch, I'll show you the numbers either way.",
    outreach_dm_draft:
      "$3,100 for 11 jobs is $282/booked job. LSA in Tampa runs $45-70. Happy to show you the setup — 15 min, no pitch.",
    outreach_phone_script:
      "Hey Marcus, this is Isaiah with Aventis — I'm not selling you leads, promise. I saw your post about Angi charging $70 a pop and reselling to four competitors. Quick question: are you running Google Local Services Ads yet, or just the marketplace stuff? [pause] Reason I ask — most Tampa junk removal guys we work with cut their cost per booked job from around $280 to under $80 by switching. Worth fifteen minutes?",
    next_actions: [
      "Reply to the Reddit post publicly — other operators are reading it",
      "Email marcus@ referencing the exact $3,100/11 jobs math",
      "Call 813-555-0142 mid-morning (before afternoon job rush)",
      "Check if bayareajunkpros.example.com is already in LSA — takes 30 seconds",
    ],
    tech_stack: ["Wix", "Google Analytics", "Angi/HomeAdvisor badge"],
    services_offered: ["Residential junk removal", "Estate cleanouts", "Construction debris", "Appliance removal"],
    uses_lead_marketplace: true,
    estimated_monthly_value: 2500,
    lead_score: 94,
    intent_strength: 19,
    budget_indicators: 19,
    decision_maker_likely: 19,
    vertical_fit: 20,
  },
  {
    external_id: "sample:reddit-re-001",
    source: "reddit",
    source_url: "https://www.reddit.com/r/realtors/comments/example2",
    source_post_content:
      "Team lead in Charlotte, 6 agents. We're spending $4,200/mo on Zillow Premier Agent and honestly the lead quality has gotten terrible. Half don't answer, the other half are already working with someone. Our CRM is a Google Sheet at this point because nobody would use Follow Up Boss. Looking at alternatives before we renew in 60 days.",
    hours_ago: 6,
    vertical: "real_estate",
    person_name: "Danielle Reyes",
    company_name: "Reyes Property Group",
    email: "danielle@reyespropertygroup.example.com",
    phone: "704-555-0188",
    website: "https://reyespropertygroup.example.com",
    location: "1435 East Blvd, Charlotte, NC 28203",
    state: "NC",
    latitude: 35.2016,
    longitude: -80.8535,
    industry: "Real Estate — Team",
    company_size: "6 agents",
    matched_keywords: ["real estate team", "zillow leads", "need a better crm", "leads falling through"],
    intent_signal:
      "Spending $4,200/mo on Zillow Premier Agent and lead quality has gotten terrible. CRM is a Google Sheet. Looking at alternatives before we renew in 60 days.",
    intent_category: "pain",
    research_summary:
      "Six-agent real estate team in Charlotte NC spending $4,200/month on Zillow Premier Agent with declining lead quality. They abandoned Follow Up Boss because agents wouldn't use it, so the team runs on a Google Sheet — meaning there is effectively no follow-up automation and almost certainly no speed-to-lead discipline. There is a hard 60-day renewal deadline, which is a real decision window. This is a textbook white-label CRM plus lead-gen replacement deal.",
    pain_points: [
      "$4,200/month on Zillow with declining lead quality",
      "Leads already working with other agents (shared/low intent)",
      "CRM abandoned — running on a Google Sheet, no follow-up automation",
      "No speed-to-lead process; contact rate almost certainly under 20%",
    ],
    buying_signals: [
      "$50K/year current marketing spend — budget is unambiguous",
      "Hard 60-day renewal deadline creates urgency",
      "Already tried and rejected a CRM (knows they need one that agents will use)",
      "Team lead posting = decision maker",
    ],
    recommended_services: [
      "White-label CRM branded as 'Reyes Property Group' — agents adopt their own tool",
      "AventisAI lead-response agent replying in under 60 seconds",
      "12-touch automated nurture (80% of deals close on touch 5-12)",
      "Seller-lead campaigns to replace low-margin Zillow buyer leads",
    ],
    outreach_angle:
      "You're paying Zillow $50K/year for leads that are already working with someone. Redirect a third of that into seller leads you own and the math changes completely.",
    outreach_email_draft:
      "Danielle,\n\nSaw your post about the Zillow renewal. The pattern you described — leads that don't answer or are already working with an agent — is exactly what happens when you're buying shared buyer leads at scale.\n\nTwo things that usually move the needle for teams your size: first, speed-to-lead. Responding in under a minute versus thirty minutes is roughly a 20x difference in contact rate, and it's automatable. Second, seller leads instead of buyer leads — listings scale, buyers eat weekends.\n\nOn the CRM: the reason agents wouldn't use Follow Up Boss is almost always that it feels like someone else's software. We white-label ours so it shows up as your team's platform.\n\nYou've got 60 days before renewal. Worth a 20-minute call to map what the alternative looks like?",
    outreach_dm_draft:
      "Saw your Zillow renewal post. Speed-to-lead under 60 seconds is ~20x contact rate and it's automatable. Worth 20 min before you renew?",
    outreach_phone_script:
      "Hi Danielle, Isaiah with Aventis. I saw your post about the Zillow renewal coming up in 60 days — I'll be quick. You mentioned the team's CRM is basically a Google Sheet right now. Are you tracking how fast anyone actually responds to a new lead? [pause] The reason I ask: teams your size usually find they're at 30-plus minutes, and getting that under a minute roughly doubles closings without spending another dollar on leads. Can I show you how that works before your renewal date?",
    next_actions: [
      "Email danielle@ referencing the 60-day renewal window specifically",
      "Call 704-555-0188 — team lead, likely reachable mid-day",
      "Look up Reyes Property Group on Zillow to see current agent ratings",
      "Prepare speed-to-lead audit as the free-value opener",
    ],
    tech_stack: ["WordPress", "IDX Broker", "Zillow badge", "Google Analytics"],
    services_offered: ["Residential sales", "Buyer representation", "Listing services", "Relocation"],
    uses_lead_marketplace: true,
    estimated_monthly_value: 4000,
    lead_score: 93,
    intent_strength: 19,
    budget_indicators: 20,
    decision_maker_likely: 18,
    vertical_fit: 20,
  },
  {
    external_id: "sample:gmaps-junk-001",
    source: "googlemaps",
    source_url: "https://www.google.com/maps/place/?q=place_id:sample1",
    source_post_content:
      "Coastal Haul-Away — Junk Removal Service\nAddress: 2214 Colley Ave, Norfolk, VA 23517\nPhone: (757) 555-0167\nWebsite: NONE LISTED\nGoogle rating: 4.9 (8 reviews)\nAssessment: NO WEBSITE — huge opportunity, running on GMB + word of mouth alone",
    hours_ago: 9,
    vertical: "junk_removal",
    person_name: "Tyrell Woods",
    company_name: "Coastal Haul-Away",
    email: "coastalhaulaway@gmail.example.com",
    phone: "757-555-0167",
    website: "https://coastalhaulaway.example.com",
    location: "2214 Colley Ave, Norfolk, VA 23517",
    state: "VA",
    latitude: 36.8712,
    longitude: -76.3005,
    industry: "Junk Removal & Hauling",
    company_size: "1 truck, owner-operator",
    matched_keywords: ["junk removal service", "verified business", "no website"],
    intent_signal:
      "Coastal Haul-Away — verified junk removal service in Norfolk with 4.9 stars but only 8 reviews and NO website",
    intent_category: "launching",
    research_summary:
      "Owner-operator junk removal business in Norfolk VA with a Google Business Profile, a real phone number, and a 4.9 rating — but only 8 reviews and no website at all. That combination is the single best profile for our services: he's clearly doing quality work (4.9 stars) but he's invisible outside of GMB. A website plus review acceleration plus LSA would likely double his volume within 90 days. Low current spend means a smaller starting package, but very low competition for his attention since nobody is selling to businesses without websites.",
    pain_points: [
      "No website at all — invisible to anyone who searches outside the map pack",
      "Only 8 reviews, so he loses the map pack to 100-review competitors",
      "Owner-operator: every call missed while on a job is lost revenue",
      "No way to capture quotes online; everything is phone tag",
    ],
    buying_signals: [
      "4.9 rating proves service quality (worth marketing)",
      "Active GMB with real phone number = operating business",
      "No website = no incumbent web vendor to displace",
      "Norfolk market has room; not saturated",
    ],
    recommended_services: [
      "Fast-launch website with photo-quote intake form",
      "Google Business Profile optimization + review acceleration to 50+",
      "Local Services Ads once reviews support it",
      "AventisAI phone answering so on-site calls get captured",
    ],
    outreach_angle:
      "You've got a 4.9 rating and 8 reviews — the rating is doing nothing for you because there's no website and not enough reviews to win the map pack.",
    outreach_email_draft:
      "Hi Tyrell,\n\nFound Coastal Haul-Away on Google Maps. 4.9 stars is excellent — that's better than most of the bigger operators in Norfolk.\n\nThe problem is nobody sees it. With 8 reviews you're not showing up in the map pack for 'junk removal norfolk,' and with no website there's nowhere for people who do find you to book or get a quote.\n\nI work specifically with junk removal operators. For someone in your position the fastest wins are usually: a simple site with a photo-quote form, a review push to get you past 50, and then Local Services Ads once the reviews support it.\n\nHappy to show you what the competitors ranking above you are doing differently — 10 minutes, free either way.",
    outreach_dm_draft:
      "Saw Coastal Haul-Away on Maps — 4.9 stars is great but with 8 reviews and no site you're invisible. Free 10-min teardown?",
    outreach_phone_script:
      "Hey Tyrell, Isaiah here — I found Coastal Haul-Away on Google Maps. First off, 4.9 stars, that's better than most of the big guys in Norfolk. Quick question though: when someone searches 'junk removal Norfolk' on their phone, do you know where you show up? [pause] Right — you're not in the top three, and it's not because of your work, it's because you've got 8 reviews and the guys above you have 90. That's fixable in about 60 days. Got two minutes for me to explain how?",
    next_actions: [
      "Call 757-555-0167 — owner-operator, best reached early morning or evening",
      "Screenshot the current map-pack results for 'junk removal norfolk' as the opener",
      "Prepare 3-page quick-launch site mockup",
    ],
    tech_stack: ["Google Business Profile only"],
    services_offered: ["Junk removal", "Appliance haul-away", "Yard debris"],
    uses_lead_marketplace: false,
    estimated_monthly_value: 1200,
    lead_score: 84,
    intent_strength: 12,
    budget_indicators: 14,
    decision_maker_likely: 20,
    vertical_fit: 20,
  },
  {
    external_id: "sample:gmaps-re-001",
    source: "googlemaps",
    source_url: "https://www.google.com/maps/place/?q=place_id:sample2",
    source_post_content:
      "Harborline Property Management — Property Management Company\nAddress: 88 Broad St, Boston, MA 02110\nPhone: (617) 555-0173\nWebsite: harborlinepm.example.com\nGoogle rating: 4.2 (34 reviews)\nAssessment: Solid review base, room to scale with paid + SEO",
    hours_ago: 14,
    vertical: "real_estate",
    person_name: "Alicia Chen",
    company_name: "Harborline Property Management",
    email: "alicia@harborlinepm.example.com",
    phone: "617-555-0173",
    website: "https://harborlinepm.example.com",
    location: "88 Broad St, Boston, MA 02110",
    state: "MA",
    latitude: 42.3583,
    longitude: -71.0537,
    industry: "Real Estate — Property Management",
    company_size: "8-15 employees",
    matched_keywords: ["property management", "verified business", "real estate"],
    intent_signal:
      "Harborline Property Management — established Boston PM company, 34 reviews, WordPress site with no lead capture beyond a contact form",
    intent_category: "shopping",
    research_summary:
      "Established property management company in downtown Boston with 34 Google reviews and a dated WordPress site. Property management is a high-LTV vertical for us — each new door under management is recurring revenue for them, so their willingness to pay for door-acquisition marketing is high. Their site has a generic contact form, no owner-portal marketing, and no evidence of paid acquisition. The pitch here is owner-lead generation: getting more landlords to hand them doors.",
    pain_points: [
      "No paid acquisition running — growth is referral-dependent",
      "Dated WordPress site with generic contact form only",
      "34 reviews in a competitive Boston market",
      "No content targeting 'property management boston' owner searches",
    ],
    buying_signals: [
      "Established business with downtown Boston address (real overhead, real revenue)",
      "Property management = recurring revenue per door, high LTV justifies marketing spend",
      "8-15 employees indicates meaningful scale",
      "Boston market rents support premium PM fees",
    ],
    recommended_services: [
      "Owner-lead campaigns targeting landlords (Google + Meta)",
      "White-label owner portal to differentiate from competitors",
      "Local SEO for 'property management boston' and neighborhood terms",
      "AventisAI intake agent for prospective-owner inquiries",
    ],
    outreach_angle:
      "Every new door you sign is recurring revenue. You're growing on referrals only — one paid channel targeting landlords changes your growth curve.",
    outreach_email_draft:
      "Hi Alicia,\n\nCame across Harborline while looking at Boston property management companies. 4.2 across 34 reviews in that market is solid.\n\nWhat stood out is that I can't find you running any paid acquisition targeting landlords — which means growth is almost entirely referral-driven. In property management that's the most common ceiling: referrals are great but they don't compound on a schedule.\n\nThe highest-ROI play for PM companies your size is usually owner-lead campaigns — going directly after landlords searching for management, where each signed door is recurring revenue for years.\n\nWorth 20 minutes to look at what that would cost per signed door in Boston?",
    outreach_dm_draft:
      "Saw Harborline — solid reviews but no paid acquisition targeting landlords. Each door is recurring revenue. Worth 20 min?",
    outreach_phone_script:
      "Hi Alicia, Isaiah with Aventis. I work with property management companies on owner acquisition specifically. Quick question — where's most of your new door growth coming from right now, referrals or something else? [pause] That's what I figured. The ceiling with referrals is they don't compound on a schedule. We run owner-lead campaigns that get landlords calling you directly, and since each door is recurring, the payback math is usually under 90 days. Can I show you the numbers for the Boston market?",
    next_actions: [
      "Email alicia@ with owner-acquisition angle (not generic marketing)",
      "Call 617-555-0173 during business hours",
      "Research their current door count if publicly stated",
      "Check whether competitors are running Google Ads for 'property management boston'",
    ],
    tech_stack: ["WordPress", "Google Analytics", "Mailchimp"],
    services_offered: ["Residential property management", "Tenant placement", "Maintenance coordination", "Rent collection"],
    uses_lead_marketplace: false,
    estimated_monthly_value: 3000,
    lead_score: 79,
    intent_strength: 10,
    budget_indicators: 18,
    decision_maker_likely: 16,
    vertical_fit: 20,
  },
  {
    external_id: "sample:indeed-junk-001",
    source: "indeed",
    source_url: "https://www.indeed.com/viewjob?jk=sample1",
    source_post_content:
      "Atlas Junk & Hauling is hiring: Junk Removal Driver / Crew Lead — Atlanta GA. Full-time, $19-24/hr plus tips. We're adding our 4th truck and need experienced crew. Must have clean driving record.\n\nSignal: a junk removal business hiring means they have more work than capacity — they're growing and have payroll budget.",
    hours_ago: 26,
    vertical: "junk_removal",
    person_name: "Devon Marsh",
    company_name: "Atlas Junk & Hauling",
    email: "info@atlasjunkatl.example.com",
    phone: "404-555-0119",
    website: "https://atlasjunkatl.example.com",
    location: "1372 Memorial Dr SE, Atlanta, GA 30317",
    state: "GA",
    latitude: 33.7454,
    longitude: -84.3357,
    industry: "Junk Removal & Hauling",
    company_size: "3 trucks (adding 4th), ~10 employees",
    matched_keywords: ["junk removal driver", "hiring", "verified business", "junk removal"],
    intent_signal:
      "Atlas Junk & Hauling hiring a Junk Removal Driver in Atlanta — adding their 4th truck, meaning demand exceeds capacity",
    intent_category: "hiring",
    research_summary:
      "Atlanta junk removal company adding a 4th truck and hiring crew at $19-24/hr. Adding trucks is the clearest possible growth signal in this vertical — it means they have more demand than capacity and are reinvesting. Their site runs GoHighLevel, which means someone already sold them software but likely not the marketing execution to fill it. That's our opening: they have the tooling, they need the demand engine to keep four trucks busy year-round, especially through the winter trough.",
    pain_points: [
      "Adding capacity means they now need to fill 4 trucks, not 3",
      "Winter seasonality will hit harder with higher fixed costs",
      "GoHighLevel installed but likely underutilized (common pattern)",
      "Hiring at $19-24/hr raises the cost of idle capacity",
    ],
    buying_signals: [
      "Adding a 4th truck = capital reinvestment and demand exceeding capacity",
      "Paying $19-24/hr = real payroll, real revenue",
      "Already bought GoHighLevel = willing to spend on tooling",
      "Atlanta is a large, ad-viable market",
    ],
    recommended_services: [
      "Demand generation to keep truck #4 booked (LSA + paid search)",
      "Winter-season campaign strategy for the January-February trough",
      "GoHighLevel buildout — they own it, they're not using it",
      "Commercial/property-manager account acquisition for recurring volume",
    ],
    outreach_angle:
      "Adding a fourth truck is the easy part. Keeping it booked through February is the part that kills margins — that's what I'd help with.",
    outreach_email_draft:
      "Devon,\n\nSaw you're hiring crew for a fourth truck — congrats, that's real growth.\n\nThe part that usually bites operators at your stage isn't the summer, it's January and February. Fixed costs went up with truck four, and demand drops 30-40% in the winter trough. Most companies end up either cutting crew or eating the loss.\n\nTwo things fix it: a commercial book (property managers, realtors doing turnovers, contractors) that doesn't swing seasonally, and a paid channel you can throttle up when residential slows.\n\nI noticed you're on GoHighLevel already — most operators buy it and use maybe 20% of it. Happy to show you what a full buildout looks like alongside the demand side. 15 minutes?",
    outreach_dm_draft:
      "Saw you're adding a 4th truck — nice. The hard part is keeping it booked in Jan/Feb. That's what I'd help with. 15 min?",
    outreach_phone_script:
      "Hey Devon, Isaiah with Aventis. Saw the job post for the fourth truck — congrats on the growth. Quick question and I'll let you go: what's your plan for keeping four trucks busy in January and February? [pause] Yeah, that's the one that gets everybody. We build commercial books — property managers, realtors doing turnovers — so the winter doesn't gut you. Worth fifteen minutes to walk through?",
    next_actions: [
      "Email info@atlasjunkatl referencing the 4th truck specifically",
      "Call 404-555-0119 — ask for Devon",
      "Check if they're bidding on 'junk removal atlanta' in Google Ads",
      "Prep the commercial-accounts pitch (their biggest seasonal fix)",
    ],
    tech_stack: ["GoHighLevel", "WordPress", "Google Analytics", "Meta Pixel"],
    services_offered: ["Residential junk removal", "Commercial cleanouts", "Construction debris", "Dumpster alternative"],
    uses_lead_marketplace: false,
    estimated_monthly_value: 3500,
    lead_score: 88,
    intent_strength: 15,
    budget_indicators: 20,
    decision_maker_likely: 16,
    vertical_fit: 20,
  },
  {
    external_id: "sample:firecrawl-re-001",
    source: "firecrawl",
    source_url: "https://mitchellrealtyphilly.example.com",
    source_post_content:
      "Mitchell Realty Group — Philadelphia real estate brokerage. 12 agents. Site shows Zillow Premier Agent badge and Realtor.com featured listings. Contact form only, no lead capture beyond that. WordPress with IDX Broker plugin. 'Serving Philadelphia and the Main Line since 2011.'",
    hours_ago: 11,
    vertical: "real_estate",
    person_name: "Robert Mitchell",
    company_name: "Mitchell Realty Group",
    email: "rmitchell@mitchellrealtyphilly.example.com",
    phone: "215-555-0154",
    website: "https://mitchellrealtyphilly.example.com",
    location: "1845 Walnut St, Philadelphia, PA 19103",
    state: "PA",
    latitude: 39.9506,
    longitude: -75.1717,
    industry: "Real Estate — Brokerage",
    company_size: "12 agents",
    matched_keywords: ["real estate brokerage", "zillow leads", "realtor.com leads", "real estate"],
    intent_signal:
      "Mitchell Realty Group — 12-agent Philadelphia brokerage displaying BOTH Zillow Premier Agent and Realtor.com badges, meaning they're paying two marketplaces simultaneously",
    intent_category: "shopping",
    research_summary:
      "Twelve-agent Philadelphia brokerage operating since 2011. Their site displays both a Zillow Premier Agent badge and Realtor.com featured listings, meaning they're paying two lead marketplaces at once — at 12 agents that's likely $6,000-12,000/month combined. Their own site has nothing but a contact form: no lead magnet, no valuation tool, no nurture capture. Everything they've built is renting attention rather than owning it. Strong candidate for a white-label CRM plus owned-channel buildout.",
    pain_points: [
      "Paying two marketplaces simultaneously (Zillow + Realtor.com)",
      "Estimated $6-12K/month going to shared, low-intent leads",
      "Own website captures nothing beyond a generic contact form",
      "No home-valuation tool = zero seller-lead capture",
      "12 agents with no shared follow-up system visible",
    ],
    buying_signals: [
      "Two marketplace subscriptions = very large proven budget",
      "12 agents = meaningful scale, per-seat software economics work",
      "14 years in business = stable, not a flight risk",
      "Philadelphia + Main Line = high price points, high commissions",
    ],
    recommended_services: [
      "White-label CRM branded as Mitchell Realty's own agent platform",
      "Home-valuation lead magnet to capture seller leads they currently miss",
      "AventisAI speed-to-lead responder across all 12 agents",
      "Gradual marketplace-spend reallocation into owned channels",
    ],
    outreach_angle:
      "You're paying Zillow and Realtor.com at the same time while your own site captures nothing but contact-form submissions. That's renting your entire pipeline.",
    outreach_email_draft:
      "Robert,\n\nI was looking at Philadelphia brokerages and noticed Mitchell Realty is running both Zillow Premier Agent and Realtor.com featured placement. At 12 agents that's a significant monthly number going to leads you don't own and that get resold.\n\nMeanwhile your own site — which already ranks for your brand and has IDX — captures nothing but contact-form submissions. No valuation tool, no seller capture, no nurture.\n\nThe play I'd propose isn't cutting the marketplaces cold. It's building the owned channel alongside them so that in six months you can decide from a position of strength whether you still need both.\n\nWorth a 25-minute conversation? I'll bring a breakdown of what your site should be capturing at your traffic level.",
    outreach_dm_draft:
      "Noticed Mitchell Realty runs both Zillow AND Realtor.com while your own site only has a contact form. That's renting your whole pipeline. Worth a chat?",
    outreach_phone_script:
      "Robert, Isaiah with Aventis — I work with brokerages on owned lead channels. I'll be direct: I noticed you're running both Zillow Premier Agent and Realtor.com featured listings. Are you happy with what those two are returning across your twelve agents? [pause] Here's why I ask — your own site has IDX and ranks for your brand, but it's not capturing anything except contact forms. No valuation tool, no seller capture. That's usually the single biggest miss at your size. Can I walk you through what it should be doing?",
    next_actions: [
      "Email rmitchell@ with the two-marketplace observation as the hook",
      "Call 215-555-0154 and ask for Robert directly",
      "Pull their site traffic estimate to quantify the capture gap",
      "Prepare valuation-tool demo — highest-converting seller magnet",
    ],
    tech_stack: ["WordPress", "IDX Broker", "Zillow badge", "Realtor.com badge", "Google Analytics"],
    services_offered: ["Residential sales", "Luxury listings", "Main Line specialization", "Buyer representation"],
    uses_lead_marketplace: true,
    estimated_monthly_value: 5500,
    lead_score: 90,
    intent_strength: 14,
    budget_indicators: 20,
    decision_maker_likely: 18,
    vertical_fit: 20,
  },
  {
    external_id: "sample:registry-junk-001",
    source: "businessregistry",
    source_url: "https://opencorporates.com/companies/us_sc/sample1",
    source_post_content:
      "Lowcountry Cleanout Services LLC — newly registered LLC in SC\nIncorporated: 6 weeks ago\nAddress: 445 Meeting St, Charleston, SC 29403\n\nSignal: brand-new junk removal / hauling entity with a legal address and almost certainly zero marketing infrastructure.",
    hours_ago: 40,
    vertical: "junk_removal",
    person_name: "Jared Kim",
    company_name: "Lowcountry Cleanout Services LLC",
    email: "jared@lowcountrycleanout.example.com",
    phone: "843-555-0131",
    website: "https://lowcountrycleanout.example.com",
    location: "445 Meeting St, Charleston, SC 29403",
    state: "SC",
    latitude: 32.7957,
    longitude: -79.9357,
    industry: "Junk Removal & Hauling",
    company_size: "startup, 1-2 people",
    matched_keywords: ["cleanout", "new business", "just registered", "junk removal"],
    intent_signal:
      "Lowcountry Cleanout Services LLC registered in South Carolina 6 weeks ago — brand new junk removal entity, no marketing infrastructure",
    intent_category: "launching",
    research_summary:
      "Junk removal / cleanout LLC registered in Charleston SC six weeks ago. Has a barebones one-page site and a business phone. Brand-new operators are lower immediate revenue but extremely low-friction to close: no incumbent vendor, no marketing habits to unlearn, and they're actively figuring out how to get their first customers. Charleston is a strong market for estate cleanouts given the demographics. Worth a lower-priced starter package with room to grow.",
    pain_points: [
      "Zero customers, zero marketing infrastructure",
      "One-page site with no quote form",
      "No Google Business Profile claimed yet",
      "No reviews at all — invisible in the map pack",
    ],
    buying_signals: [
      "Registered LLC with real address = serious, not a side hustle",
      "Already has a domain and business phone",
      "Charleston estate-cleanout market is strong (older demographics)",
      "No incumbent vendor to displace",
    ],
    recommended_services: [
      "Launch package: Google Business Profile claim + optimization",
      "Simple site with photo-quote intake",
      "First-50-reviews campaign",
      "Estate-cleanout focused local SEO (higher ticket than general junk)",
    ],
    outreach_angle:
      "You registered six weeks ago — the businesses that win in this space claim and optimize their Google profile in month one, not month six.",
    outreach_email_draft:
      "Jared,\n\nSaw Lowcountry Cleanout registered with the state recently — congrats on launching.\n\nOne thing worth knowing early: in junk removal, roughly 70% of residential jobs start with a phone search that lands on the Google map pack. The operators who win claim and optimize their Google Business Profile in month one and start collecting reviews immediately. The ones who wait six months spend the next two years trying to catch up.\n\nCharleston specifically is a strong estate-cleanout market — higher tickets than general junk hauling, and less competition on those keywords.\n\nI put together a 90-day launch playbook for new junk removal operators. Happy to send it over free, no strings — just reply and I'll email it.",
    outreach_dm_draft:
      "Saw Lowcountry Cleanout just registered. 70% of residential junk jobs start in the Google map pack — claim your profile now, not in 6 months. Free 90-day playbook if useful.",
    outreach_phone_script:
      "Hey Jared, Isaiah with Aventis — I work with junk removal operators. Saw Lowcountry Cleanout registered recently, congrats. Quick question: have you claimed your Google Business Profile yet? [pause] That's the single highest-leverage thing you can do in your first ninety days — most of your residential calls will come from there. I've got a free launch playbook specific to junk removal. Want me to send it over?",
    next_actions: [
      "Email jared@ with the free 90-day playbook offer (value-first for a new business)",
      "Call 843-555-0131 — new owners answer their phones",
      "Verify whether their Google Business Profile is claimed",
      "Position estate cleanouts as the higher-ticket wedge",
    ],
    tech_stack: ["GoDaddy Website Builder"],
    services_offered: ["Estate cleanouts", "Junk removal", "Garage cleanouts"],
    uses_lead_marketplace: false,
    estimated_monthly_value: 900,
    lead_score: 71,
    intent_strength: 9,
    budget_indicators: 10,
    decision_maker_likely: 20,
    vertical_fit: 20,
  },
  {
    external_id: "sample:twitter-re-001",
    source: "twitter",
    source_url: "https://twitter.com/example/status/sample1",
    source_post_content:
      "Just cancelled Zillow. $2,800/month for leads that ghost me 90% of the time. Going all in on my sphere and referrals. If anyone has a follow-up system that actually works for a solo agent, I'm all ears.\n\n--- Author bio ---\nRealtor | Miami + Coral Gables | Helping families find home since 2016",
    hours_ago: 5,
    vertical: "real_estate",
    person_name: "Sofia Alvarez",
    company_name: "Sofia Alvarez Realty",
    email: "sofia@sofiaalvarezrealty.example.com",
    phone: "305-555-0176",
    website: "https://sofiaalvarezrealty.example.com",
    location: "2222 Ponce de Leon Blvd, Coral Gables, FL 33134",
    state: "FL",
    latitude: 25.7509,
    longitude: -80.2586,
    industry: "Real Estate — Solo Agent",
    company_size: "solo agent",
    matched_keywords: ["zillow leads", "realtor", "follow up sequence", "real estate"],
    intent_category: "complaint",
    intent_signal:
      "Just cancelled Zillow. $2,800/month for leads that ghost me 90% of the time. If anyone has a follow-up system that actually works for a solo agent, I'm all ears.",
    research_summary:
      "Solo realtor in Coral Gables who just cancelled a $2,800/month Zillow subscription and publicly asked for a follow-up system recommendation. This is about as close to a raised hand as it gets: budget just freed up, explicit request for exactly what we sell, and she named the problem herself. Miami/Coral Gables is a high-price market so her commission per deal is well above national average, which makes the ROI math easy.",
    pain_points: [
      "Just lost her primary lead source (self-inflicted but now needs replacement)",
      "90% ghost rate on paid leads",
      "No follow-up system for sphere/referral nurture",
      "Solo agent = no admin support for consistent follow-up",
    ],
    buying_signals: [
      "$2,800/month just freed up from cancelled Zillow",
      "Publicly asking for a follow-up system — direct buying question",
      "Coral Gables market = high commissions per transaction",
      "9 years in business = established sphere worth nurturing",
    ],
    recommended_services: [
      "White-label CRM with automated sphere nurture",
      "AventisAI follow-up agent for speed-to-lead on referrals",
      "Seller-focused campaigns using the freed-up Zillow budget",
      "Database reactivation campaign against her existing sphere",
    ],
    outreach_angle:
      "You just freed up $2,800/month and asked for a follow-up system. That budget put into sphere reactivation typically outperforms Zillow within one quarter.",
    outreach_email_draft:
      "Sofia,\n\nSaw your post about cancelling Zillow — honestly, good call at a 90% ghost rate.\n\nYou asked about follow-up systems for solo agents. The single highest-ROI thing you can do with that freed-up $2,800 isn't buying different leads, it's reactivating the database you already have. Nine years of past clients and sphere contacts, most of whom haven't heard from you in a structured way.\n\nWhat that looks like: automated multi-touch sequences that go out without you thinking about it, plus instant response on any inbound so referrals don't sit. For a solo agent that's usually worth 2-4 extra transactions a year, which in Coral Gables is real money.\n\nHappy to show you the system on a 20-minute call. I'll also send the sphere-reactivation template either way.",
    outreach_dm_draft:
      "Saw you cancelled Zillow — smart at a 90% ghost rate. That $2,800 into sphere reactivation usually beats it within a quarter. Want the template I use?",
    outreach_phone_script:
      "Hi Sofia, Isaiah with Aventis. Saw your post about cancelling Zillow — 90% ghost rate, I don't blame you. You asked about follow-up systems for solo agents, so I'll cut to it: with nine years of past clients, the fastest return isn't buying new leads, it's a structured reactivation of the database you already have. Most solo agents in your position pick up two to four extra deals a year from that alone. Want me to walk you through what it looks like?",
    next_actions: [
      "Reply to her X post publicly — others in the same spot are watching",
      "DM Sofia on X referencing the sphere-reactivation angle",
      "Email sofia@ with the free template as value-first",
      "Call 305-555-0176 — solo agents answer their phones",
    ],
    tech_stack: ["Squarespace", "Calendly", "Mailchimp"],
    services_offered: ["Residential sales", "Coral Gables specialization", "Buyer representation", "Relocation"],
    uses_lead_marketplace: false,
    estimated_monthly_value: 1800,
    lead_score: 89,
    intent_strength: 20,
    budget_indicators: 16,
    decision_maker_likely: 20,
    vertical_fit: 20,
  },
];

export async function seedSampleLeadsIfEmpty(): Promise<boolean> {
  const sql = db();
  try {
    const [{ count }] = (await sql`SELECT COUNT(*)::text AS count FROM leads`) as Array<{
      count: string;
    }>;
    if (parseInt(count, 10) > 0) return false;

    await log(
      "info",
      "seed_starting",
      `Empty leads table — inserting ${SAMPLES.length} junk removal / real estate sample leads`
    );

    for (const s of SAMPLES) {
      const breakdown = {
        intent_strength: s.intent_strength,
        budget_indicators: s.budget_indicators,
        decision_maker_likely: s.decision_maker_likely,
        vertical_fit: s.vertical_fit,
        east_coast_bonus: 18,
        reasoning: "Sample seed lead — East Coast, in-vertical, fully contactable",
      };
      await sql`
        INSERT INTO leads (
          external_id, source, source_url, source_post_content, source_post_at,
          person_name, company_name, email, phone, website, location, state, is_east_coast,
          latitude, longitude, geocoded_address, vertical,
          industry, company_size, matched_keywords, intent_signal, intent_category,
          research_status, research_summary, pain_points, buying_signals, recommended_services,
          outreach_angle, outreach_email_draft, outreach_dm_draft, outreach_phone_script,
          estimated_monthly_value, next_actions, tech_stack, services_offered,
          uses_lead_marketplace, lead_score, score_breakdown, status, notified, last_researched_at,
          contactability_score, has_email, has_phone, has_website, best_email, best_phone,
          email_confidence
        ) VALUES (
          ${s.external_id}, ${s.source}, ${s.source_url}, ${s.source_post_content},
          now() - (${s.hours_ago} || ' hours')::interval,
          ${s.person_name}, ${s.company_name}, ${s.email}, ${s.phone}, ${s.website},
          ${s.location}, ${s.state}, true,
          ${s.latitude}, ${s.longitude}, ${s.location}, ${s.vertical},
          ${s.industry}, ${s.company_size}, ${s.matched_keywords},
          ${s.intent_signal}, ${s.intent_category},
          'completed', ${s.research_summary}, ${s.pain_points}, ${s.buying_signals},
          ${s.recommended_services}, ${s.outreach_angle}, ${s.outreach_email_draft},
          ${s.outreach_dm_draft}, ${s.outreach_phone_script},
          ${s.estimated_monthly_value}, ${s.next_actions}, ${s.tech_stack}, ${s.services_offered},
          ${s.uses_lead_marketplace}, ${s.lead_score}, ${JSON.stringify(breakdown)}::jsonb,
          'new', false, now() - (${Math.max(1, s.hours_ago - 1)} || ' hours')::interval,
          92, true, true, true, ${s.email}, ${s.phone}, 'verified'
        )
        ON CONFLICT (external_id) DO NOTHING
      `;
    }

    await sql`
      INSERT INTO generation_runs (
        started_at, completed_at, status, sources_attempted, sources_succeeded,
        raw_signals_found, leads_created, leads_researched, leads_qualified,
        notification_sent, metadata
      ) VALUES (
        now() - interval '30 minutes', now() - interval '27 minutes', 'completed',
        ARRAY['googlemaps','firecrawl','indeed','businessregistry','reddit','google','twitter'],
        ARRAY['googlemaps','firecrawl','indeed','businessregistry','reddit'],
        84, ${SAMPLES.length}, ${SAMPLES.length}, 7, true,
        '{"rejected_off_vertical": 41, "rejected_uncontactable": 26, "leads_geocoded": 8}'::jsonb
      )
    `;

    await sql`
      INSERT INTO lead_activities (lead_id, type, title, content, created_by)
      SELECT id, 'research_update', 'Initial AI research completed', research_summary, 'system'
      FROM leads WHERE external_id LIKE 'sample:%'
    `;

    await log("info", "seed_complete", `Inserted ${SAMPLES.length} vertical-focused sample leads`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("error", "seed_failed", msg);
    return false;
  }
}
