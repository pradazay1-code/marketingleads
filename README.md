# Aventis Leads

Autonomous lead generation + CRM for **Aventis Marketing** and **AventisAI**.

This system runs by itself, 24/7, in the cloud. Every 4 hours it scans the public
internet for people who need marketing services or white-label software, deeply
researches each one with Claude, scores them, and sends you an SMS + email with
the qualified leads. In between cycles it keeps researching to deepen each lead.

You log into the CRM only when you want to work the leads.

---

## What the system does

| What | How |
|---|---|
| Find leads from **Facebook-group-style** sources (without violating TOS) | Reddit (r/smallbusiness, r/Entrepreneur, r/marketing, etc), Indie Hackers, Hacker News — public forums where founders openly post needs |
| Find leads from the broader web | Google Programmable Search across "looking for marketing agency", "fired our agency", etc |
| Find leads via Twitter/X | Real-time intent search via the official API |
| Find leads via **hiring signals** | Indeed job postings for marketing roles = companies needing marketing help with budget |
| Find leads via **new businesses** | OpenCorporates feeds of newly-registered East Coast businesses |
| Find leads via **product launches** | ProductHunt & Show HN — founders looking for growth |
| Deeply research each lead | Claude (Opus 4.7) reads the post + scrapes their website + produces a structured report |
| Score each lead | 0–100 across intent, budget, decision-maker, fit, East Coast bonus |
| Notify you when there are qualified leads | SMS (Twilio) + HTML email (Resend), every 4 hours |
| Track leads through your pipeline | Built-in CRM: New → Contacted → Qualified → Opportunity → Won |

> **About Facebook groups specifically:** Facebook actively detects and bans
> scrapers — any system that scrapes FB groups will be killed within days,
> defeating "always running". This system uses *higher-quality* sources that
> achieve the same goal legitimately. Reddit alone surfaces ~5–20 explicit
> "need marketing help" posts per day across the subreddits we monitor.

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
         │                          │ Reddit, HN, etc  │
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                          ┌──────────────────┐
         │                          │ Claude Opus 4.7  │
         │                          │ Deep research    │
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                          ┌──────────────────┐
         │                          │ Supabase Postgres│
         │                          └────────┬─────────┘
         │                                    │
         │                                    ▼
         │                       ┌──────────────────────┐
         │                       │ Twilio SMS + Resend  │
         │                       │ Email to your phone  │
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
external services you need are free-tier accounts at Supabase, Anthropic,
Twilio, and Resend. **No server you have to keep running.**

---

## Setup (one-time, ~30 min)

### 1. Sign up for the free services

You'll need accounts at:

| Service | What it does | Cost |
|---|---|---|
| [Supabase](https://supabase.com) | Database (always-on PostgreSQL) | Free tier is plenty |
| [Anthropic](https://console.anthropic.com) | Claude AI research | Pay-as-you-go (~$0.03 per lead researched) |
| [Twilio](https://twilio.com) | SMS to your phone | ~$1/month + $0.008 per SMS |
| [Resend](https://resend.com) | Email backup notifications | Free for 3000/month |
| [Netlify](https://netlify.com) | Hosting + cron | Free tier is plenty |
| [Google Cloud](https://developers.google.com/custom-search) | Web search (optional but recommended) | 100 free searches/day |

### 2. Set up the database

1. Create a new Supabase project
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → run
3. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Deploy to Netlify

1. Push this repo to GitHub (already done if you're reading this in the repo)
2. In Netlify, click **Add new site → Import from Git → pick this repo**
3. The build settings are auto-detected from `netlify.toml`
4. Before clicking "Deploy", click **Site settings → Environment variables**
   and paste in every var from `.env.example` (replace placeholder values)
5. Deploy. After it's live, Netlify automatically activates the scheduled
   functions (you'll see them under **Functions → Scheduled**)

### 4. Verify it's running

- Open your Netlify URL → you should see the CRM dashboard
- Go to **Settings** → enter your `CRON_SECRET` → click **Run now**
- In ~60 seconds you should see leads appearing in the leads list
- You should get an SMS + email if any leads scored ≥65

That's it. The system now runs forever.

---

## How the 4-hour cycle works

```
T+0:00  scheduled-lead-gen fires
        ├─ fetches signals from 8 sources in parallel (~30s)
        ├─ dedupes vs. existing leads
        ├─ pre-scores; drops obvious junk (<25 pre-score)
        ├─ for top 15: calls Claude Opus to research deeply (~3-5 min)
        ├─ updates each lead with summary, pain points, outreach angle
        └─ for leads scoring ≥65: sends SMS + email batch

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

- Claude: ~60 leads × $0.03 = **~$1.80/day**
- Twilio SMS: 6 messages × $0.008 = **~$0.05/day**
- Everything else: free tier

So **~$60/month all-in** for fully autonomous lead generation.

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
  pipeline.ts              # Orchestrator: fetch → score → research → notify
  db.ts                    # Supabase clients (service + anon)
  keywords.ts              # Intent keyword matching + state detection
  scoring/leadScorer.ts    # Pre-research scoring
  research/claudeResearch.ts  # Claude deep research
  notify/                  # SMS + email channels
  sources/
    reddit.ts              # r/smallbusiness, r/Entrepreneur, etc
    hackernews.ts          # Ask HN, Show HN
    googleSearch.ts        # Google Programmable Search
    twitter.ts             # X API v2
    indeed.ts              # Job postings
    producthunt.ts         # New launches
    indiehackers.ts        # Forum posts
    businessRegistry.ts    # Newly-registered businesses

supabase/
  schema.sql               # Run once in Supabase SQL editor
```

---

## Troubleshooting

**"No leads yet"** — Did you run the SQL schema in Supabase? Did you set
`ANTHROPIC_API_KEY`? Hit **Settings → Run now** and watch the result.

**"No SMS arrived"** — Twilio trial accounts can only SMS verified numbers.
Verify your number in the Twilio console, or upgrade to a paid number.

**"Source X keeps failing"** — Check the **Sources** section of Settings —
the last error is shown. Most likely you're missing an optional API key
(Twitter, Google, ProductHunt). The system still works without them; you just
get fewer leads.

**"I want it to run more often than every 4 hours"** — Edit `netlify.toml`
and change the cron expression for `scheduled-lead-gen`. `0 */2 * * *` = every 2 hours.

---

Built for Isaiah Wright · Aventis Marketing & AventisAI.
