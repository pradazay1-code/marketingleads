import type { RawSignal } from "../types";
import { detectState } from "../keywords";

/**
 * GitHub — newly-created public repos for startups/SaaS = founders launching.
 * Uses GitHub's public search API (60 req/hr unauth, 5000/hr if GITHUB_TOKEN set).
 * https://docs.github.com/en/rest/search
 */

const TOPIC_QUERIES = [
  "topic:saas created:>2024-09-01 stars:>5",
  "topic:startup created:>2024-09-01 stars:>5",
  "topic:marketing created:>2024-09-01 stars:>3",
  "topic:b2b created:>2024-09-01 stars:>3",
];

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  owner: { login: string; type: string; html_url: string };
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  homepage: string | null;
}

interface SearchResponse {
  items?: GitHubRepo[];
}

export async function fetchGithubSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const seen = new Set<string>();
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    "User-Agent": "AventisLeadsBot/1.0",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const q of TOPIC_QUERIES) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
        q
      )}&sort=updated&per_page=20`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 403) {
          console.warn(`[github] rate limited — set GITHUB_TOKEN for higher limits`);
          break;
        }
        console.warn(`[github] ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as SearchResponse;
      for (const repo of data.items ?? []) {
        const id = `github:${repo.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        // Skip personal/non-business looking repos
        if (repo.owner.type === "User" && repo.stargazers_count < 10) continue;
        if (!repo.description && !repo.homepage) continue;

        const text = `${repo.full_name} — ${repo.description ?? ""}`;
        const state = detectState(text);

        signals.push({
          external_id: id,
          source: "github" as RawSignal["source"],
          source_url: repo.html_url,
          source_post_content: text.slice(0, 3000),
          source_post_at: repo.created_at,
          person_name: repo.owner.login,
          company_name: repo.name,
          website: repo.homepage ?? undefined,
          location: state ?? undefined,
          matched_keywords: ["new public repo"],
          intent_signal: `New ${repo.language ?? "project"}: ${repo.description ?? repo.full_name}`,
          intent_category: "launching",
          raw: {
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics,
            owner_type: repo.owner.type,
            owner_url: repo.owner.html_url,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[github] error for "${q}":`, err);
    }
  }
  return signals;
}
