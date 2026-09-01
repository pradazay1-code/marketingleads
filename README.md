# Aventis Leads

Autonomous lead generation + CRM for **Aventis Marketing** and **AventisAI**.

Finds **junk removal** and **real estate** businesses on the East Coast that need
marketing help, verifies you can actually reach them, researches each one with AI,
and pushes qualified leads to your phone every 4 hours.

Runs by itself 24/7 on Netlify. You log in only when you want to work the leads.

**Core stack is free.** Firecrawl, Google Places, and Mapbox have paid tiers but
generous free allowances that cover this system's usage.

---

## What the system does

> **Focus: junk removal & real estate only.** Every keyword, source, AI prompt,
> and score is tuned for these two verticals. Anything else is filtered out
> before it reaches your CRM.

| What | How |
|---|---|
| Find **verified local businesses** | Google Places API — every result has name + address + phone + website + rating. Rotates 24 East Coast metros × 22 junk-removal/real-estate categories |
| Find **operators in pain** | Firecrawl web search across "junk removal angi leads too expensive", "zillow leads not worth it", etc — plus it scrapes each result in the same call |
| Find **growing businesses** | Indeed postings for junk removal drivers / real estate ISAs — hiring means demand exceeds capacity |
| Find **brand-new entities** | OpenCorporates filings for new hauling/realty LLCs on the East Coast |
| Find **public complaints** | Reddit (r/junkremoval, r/realtors, r/realestateinvesting) + X/Twitter intent search |
| **Get contact info** | Firecrawl structured extraction pulls emails/phones out of JS-rendered sites; plus contact-page crawl and pattern guessing (`contact@`, `first.last@`) |
| **Reject unreachable leads** | Contactability gate (0-100) — anything under 45 never enters the CRM |
| Deeply research each lead | Gemini 2.0 Flash with vertical-specific economics baked into the prompt (Angi CPLs, Zillow costs, speed-to-lead math) |
| Write your outreach | Email draft + DM draft + cold-call script, all referencing specifics from their site |
| Map your territory | Mapbox geocoding + interactive map at `/map` — amber pins for junk removal, blue for real estate |
| Notify you | ntfy.sh push + Telegram + email, every 4 hours |
| Track your pipeline | Built-in CRM: New → Contacted → Qualified → Opportunity → Won |

### The quality gate

Every candidate must pass **two** filters before it enters your CRM:

1. **Vertical gate** — is this junk removal or real estate? If not, discarded.
2. **Contactability gate** — can you actually reach them? Scored 0-100:
   email +30, phone +25, website +20, LinkedIn +10, real company name +10,
   real person name +10, location +10. Below 45 → rejected and logged.

Rejections are written to `system_log` as `rejected_uncontactable` /
off-vertical so you can audit what got filtered.

---

## Architecture

```
┌──────────────────┐   every 4h    ┌──────────────────────────┐
│ Netlify          │ ────────────▶ │ scheduled-lead-gen       │
│ Scheduled        │   every 30m   │ scheduled-deep-research  │
│ Functions        │ ────────────▶ │ scheduled-heartbeat      │
└────────┬─────────┘               └──────────┬───────────────┘
         │                                    │
         │                                    ▼
         │                          ┌──────────────────┐
         │                          │ Source scanners  │
         │                          │ Places, Firecrawl│
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                          ┌──────────────────┐
         │                          │ Gemini 2.0 Flash │
         │                          │ (FREE) — research│
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                          ┌──────────────────┐
         │                          │  Neon Postgres   │
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                       ┌──────────────────────┐
         │                       │ ntfy.sh push + Tele- │
         │                       │ gram + Resend email  │
         │                       │ ALL FREE             │
         │                       └──────────────────────┘
         ▼
┌──────────────────┐
│ Next.js CRM      │
│ Dashboard, leads,│
│ pipeline, etc    │
└──────────────────┘
```

**Why Netlify (and not something else)?** You asked for Netlify, and it
handles this well: their Scheduled Functions are a free, native cron with no
infrastructure to manage. The Next.js CRM deploys with one click. The only
external services are Neon (database), Google AI Studio (research), and
ntfy.sh (push). **No server you have to keep running.**

---

## Setup (one-time, ~30 min)

### 1. Sign up for the free services

All required services are 100% free — **no credit card needed for any of them**:

| Service | What it does | Cost |
|---|---|---|
| [Neon](https://neon.tech) | Database (serverless PostgreSQL) | **FREE** — 500MB DB, always-on |
| [Google AI Studio](https://aistudio.google.com/apikey) | Gemini 2.0 Flash for AI research | **FREE** — 1,500 req/day, no card |
| [ntfy.sh](https://ntfy.sh) | Push notifications to your phone | **FREE** — no account needed |
| [Resend](https://resend.com) | Email backup notifications | **FREE** for 3,000/month |
| [Netlify](https://netlify.com) | Hosting + cron | **FREE** tier is plenty |

**Strongly recommended** — these three transform lead quality:

| Service | What it unlocks | Free allowance |
|---|---|---|
| [Google Places API](https://console.cloud.google.com) | Verified businesses with phone + address + website. The single best source. | $200/mo credit ≈ thousands of searches |
| [Firecrawl](https://firecrawl.dev) | JS-rendered scraping + structured contact extraction + web search prospecting | Free tier available |
| [Mapbox](https://account.mapbox.com) | Geocoding + the `/map` territory view | 100k geocodes/mo free |

Optional extras (all free):
- [Groq](https://console.groq.com/keys) — AI fallback if Gemini hits limits
- [Telegram BotFather](https://t.me/BotFather) — richer push notifications
- [Google Custom Search](https://developers.google.com/custom-search) — 100 searches/day
- [Twitter Dev](https://developer.x.com) — free tier ~500k tweets/month

### 2. Set up the database (Neon)

1. Create a free project at https://neon.tech (sign in with GitHub, no card needed)
   - **Project name**: `aventis-leads`
   - **Region**: AWS / US East (N. Virginia) — closest to East Coast leads
2. Open **SQL Editor** (left sidebar) → paste the contents of `db/schema.sql` → click Run
3. On the project dashboard, find **Connection Details** → select **Pooled connection**
   → copy the URL → this is your `DATABASE_URL`

### 3. Set up free phone push notifications

**Option A — ntfy.sh (recommended, 60 seconds, no account):**
1. Install the **ntfy** app on your phone (free, in App Store / Play Store)
2. Pick a long random topic name — anything like `aventis-isaiah-x9k2p4qmnz`
   - This string is effectively your password. Keep it private (anyone who knows
     it can send you notifications). Make it long.
3. In the ntfy app, tap "+" and subscribe to that exact string
4. Set `NTFY_TOPIC` in your Netlify env vars to the same string
5. Done — every batch will appear as a push notification on your phone

**Option B — Telegram bot (optional, richer formatting):**
1. Open Telegram → search **@BotFather** → `/newbot` → save the token
2. Search **@userinfobot** → `/start` → it gives you your numeric chat ID
3. Send any message to your new bot (so it can reply back to you)
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars

You can use either, both, or neither (email-only is also fine).

### 4. Deploy to Netlify

1. Push this repo to GitHub (already done if you're reading this in the repo)
2. In Netlify, click **Add new site → Import from Git → pick this repo**
3. The build settings are auto-detected from `netlify.toml`
4. Before clicking "Deploy", click **Site settings → Environment variables**
   and paste in every var from `.env.example` (replace placeholder values)
5. Deploy. After it's live, Netlify automatically activates the scheduled
   functions (you'll see them under **Functions → Scheduled**)

### 5. Verify it's running

- Open your Netlify URL → you should see the CRM dashboard
- Go to **Settings** → enter your `CRON_SECRET` → click **Run now**
- In ~60 seconds you should see leads appearing in the leads list
- You should get a push notification + email if any leads scored ≥65

That's it. The system now runs forever, completely free.

---

## How the 4-hour cycle works

```
T+0:00  scheduled-lead-gen fires
        ├─ fetches signals from 8 sources in parallel (~30s)
        ├─ dedupes vs. existing leads
        ├─ pre-scores; drops obvious junk (<25 pre-score)
        ├─ for top 15: calls Gemini 2.0 Flash to research deeply (~3-5 min)
        ├─ updates each lead with summary, pain points, outreach angle
        └─ for leads scoring ≥65: pushes notification + email batch

T+0:30  scheduled-deep-research fires
        ├─ picks 5 still-pending leads
        └─ researches them in the background

T+1:00, T+1:30, T+2:00, ...  same as T+0:30

T+4:00  next scheduled-lead-gen fires
```

By the time you check the dashboard, every lead from the last 4 hours has
been deeply researched with a personalized outreach angle.

---

## Tuning the system

Everything is tunable from the **Settings** page in the CRM:

- **Enable/disable sources** — turn off any source that's noisy for you
- **Add/remove keywords** — the more specific the keyword, the higher the lead quality
- **Manual run** — kick off a cycle on demand
- **Thresholds** — edit `lib/pipeline.ts` to change `PRE_RESEARCH_THRESHOLD` (default 25) and `QUALIFIED_THRESHOLD` (default 65)

### Adding new lead sources

Each source is a single file in `lib/sources/` that exports a function returning
`RawSignal[]`. To add a new source:

1. Create `lib/sources/yoursource.ts`
2. Implement `fetchYourSourceSignals(): Promise<RawSignal[]>`
3. Add it to the `SOURCES` array in `lib/pipeline.ts`

### Cost expectations

For a typical day (6 cycles × ~10 leads researched each):

- Gemini 2.0 Flash: ~60 calls/day vs. 1,500 daily free quota = **$0**
- ntfy.sh push notifications: **$0**
- Telegram bot: **$0**
- Resend email: 6/day vs. 100/day free quota = **$0**
- Neon / Netlify: well within free tiers = **$0**

So **$0/month** for fully autonomous lead generation. If you ever exceed
Gemini's free 1,500 requests/day, the system automatically falls back to
Groq (also free). If you want to switch to a paid AI for higher quality
later, just set `AI_PROVIDER` and add the key — no code changes needed.

---

## Working leads in the CRM

When you tap an SMS or click an email link, you land on the lead detail page.
Each lead shows:

- **Score breakdown** — *why* Claude scored this lead
- **AI summary** — what the company does and what they need
- **Recommended Aventis fit** — which of your services match
- **Outreach angle** — a personalized opening line you can copy/paste
- **Original signal** — the raw post that triggered the match
- **Pipeline buttons** — click to move the lead through stages
- **Note + opportunity** — log calls, emails, create deals

---

## Local development

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your keys
npm run dev           # Next.js on :3000
npm run generate:once # run a single cycle locally
npm run research:once # run one deep-research tick locally
```

---

## File map

```
app/                       # Next.js CRM (the UI)
  page.tsx                 # Dashboard
  leads/                   # Leads list + detail
  pipeline/                # Kanban pipeline view
  research-queue/          # Live view of background research
  settings/                # Tune sources, keywords, manual run
  api/                     # REST endpoints the UI calls

netlify/functions/
  scheduled-lead-gen.ts    # Every 4h: full discovery cycle
  scheduled-deep-research.ts  # Every 30m: background research
  scheduled-heartbeat.ts   # Every hour: health check

lib/
  verticals.ts             # Junk removal + real estate config (the focus)
  pipeline.ts              # Orchestrator: fetch → vertical gate → enrich →
                           #   contactability gate → research → notify
  db.ts                    # Neon Postgres client + query helpers
  keywords.ts              # Vertical-specific keyword matching
  seed.ts                  # 8 sample leads inserted on first run
  quality/
    contactability.ts      # The reachability gate (0-100)
  scraping/
    firecrawl.ts           # Firecrawl scrape / extract / search client
  mapping/
    mapbox.ts              # Geocoding + static map URLs + distance
  enrichment/
    emailFinder.ts         # Contact-page crawl + email pattern generation
    companyResolver.ts     # Company name → website + LinkedIn
  research/
    enrichment.ts          # Firecrawl-first enrichment, cheerio fallback
    aiResearch.ts          # Gemini/Groq with vertical economics in the prompt
  scoring/leadScorer.ts    # Fast pre-research triage score
  notify/
    ntfy.ts                # Free phone push
    telegram.ts            # Free Telegram push
    resend.ts              # Free email
    index.ts               # Multi-channel orchestrator
  sources/
    googleMaps.ts          # Verified businesses (best source)
    firecrawlProspector.ts # Pain-search + directory prospecting
    indeed.ts              # Hiring signals in both verticals
    businessRegistry.ts    # New hauling/realty LLCs
    reddit.ts              # r/junkremoval, r/realtors, etc
    redditEnhanced.ts      # Targeted Reddit intent search
    googleSearch.ts        # Vertical intent queries
    twitter.ts             # X intent search

db/
  schema.sql               # Full schema — run once on a new database
  migrations.sql           # Idempotent upgrade for existing databases
```

---

## Troubleshooting

**"No leads yet"** — Did you run the SQL schema in Neon? Did you set
`GEMINI_API_KEY`? Hit **Settings → Run now** and watch the result.

**"No push notification arrived"** — Open the ntfy app and confirm you're
subscribed to the EXACT same string as `NTFY_TOPIC`. Tap the topic in the
app and check that notifications are enabled for it. Test it manually with
`curl -d "test" ntfy.sh/your-topic-here`.

**"Gemini said 'quota exceeded'"** — You hit the 1,500/day limit (unlikely
unless something is misconfigured looping). Set `GROQ_API_KEY` and the
system will automatically fall back to Groq.

**"Source X keeps failing"** — Check the **Sources** section of Settings —
the last error is shown. Most likely you're missing an optional API key
(Twitter, Google, ProductHunt). The system still works without them; you just
get fewer leads.

**"I want it to run more often than every 4 hours"** — Edit `netlify.toml`
and change the cron expression for `scheduled-lead-gen`. `0 */2 * * *` = every 2 hours.

---

Built for Isaiah Wright · Aventis Marketing & AventisAI.
