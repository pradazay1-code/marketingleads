export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "opportunity"
  | "won"
  | "lost"
  | "archived";

export type ResearchStatus = "pending" | "in_progress" | "completed" | "failed";

export type SourceType =
  | "reddit"
  | "google"
  | "twitter"
  | "indeed"
  | "producthunt"
  | "indiehackers"
  | "businessregistry"
  | "github"
  | "ycombinator"
  | "googlemaps"
  | "uspto"
  | "newsfunding";

export interface RawSignal {
  external_id: string;
  source: SourceType | string;
  source_url: string;
  source_post_content: string;
  source_post_at?: string;
  person_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  location?: string;
  matched_keywords: string[];
  intent_signal: string;
  intent_category?: "pain" | "shopping" | "hiring" | "launching" | "complaint" | "intent" | "service";
  raw?: Record<string, unknown>;
}

export interface Lead {
  id: string;
  external_id: string | null;
  source: string;
  source_url: string | null;
  source_post_content: string | null;
  source_post_at: string | null;

  person_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  location: string | null;
  state: string | null;
  is_east_coast: boolean;
  industry: string | null;
  company_size: string | null;

  matched_keywords: string[] | null;
  intent_signal: string | null;
  intent_category: string | null;

  research_status: ResearchStatus;
  research_summary: string | null;
  research_data: Record<string, unknown> | null;
  pain_points: string[] | null;
  buying_signals: string[] | null;
  recommended_services: string[] | null;
  outreach_angle: string | null;
  outreach_email_draft: string | null;
  outreach_dm_draft: string | null;
  next_actions: string[] | null;
  tech_stack: string[] | null;
  social_links: Record<string, string> | null;
  domain_age_estimate: string | null;
  last_researched_at: string | null;

  lead_score: number;
  score_breakdown: Record<string, unknown> | null;
  contactability_score: number;
  has_email: boolean;
  has_phone: boolean;
  has_website: boolean;
  has_linkedin: boolean;
  contact_emails: string[] | null;
  contact_phones: string[] | null;
  email_confidence: "verified" | "probable" | "guess" | null;
  best_email: string | null;
  best_phone: string | null;

  status: LeadStatus;
  assigned_to: string | null;

  notified: boolean;
  notified_at: string | null;
  notification_batch_id: string | null;

  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: string;
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string;
}

export interface Opportunity {
  id: string;
  lead_id: string;
  name: string;
  service_type: string | null;
  estimated_mrr: number | null;
  estimated_one_time: number | null;
  probability: number;
  stage: "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  sources_attempted: string[] | null;
  sources_succeeded: string[] | null;
  raw_signals_found: number;
  leads_created: number;
  leads_researched: number;
  leads_qualified: number;
  notification_sent: boolean;
  errors: unknown;
  metadata: Record<string, unknown> | null;
}

export interface Keyword {
  id: string;
  phrase: string;
  category: string;
  weight: number;
  enabled: boolean;
}
