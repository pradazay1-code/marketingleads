import type { RawSignal } from "../types";

interface PHEdge {
  node: {
    id: string;
    name: string;
    tagline: string;
    description: string;
    slug: string;
    createdAt: string;
    url: string;
    website: string | null;
    makers: { name: string; username: string; twitterUsername: string | null }[];
    topics: { edges: { node: { name: string } }[] };
  };
}

/**
 * ProductHunt — new launches are founders actively looking for traction.
 * Many of these founders need marketing help. The public GraphQL endpoint
 * uses a token; the simpler approach is the unauthed daily-leaderboard scrape
 * via JSON-LD. We fall back to that if PH_TOKEN isn't set.
 */
export async function fetchProductHuntSignals(): Promise<RawSignal[]> {
  // Try GraphQL if token is configured
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (token) {
    return fetchViaGraphQL(token);
  }
  return fetchViaPublicJson();
}

async function fetchViaGraphQL(token: string): Promise<RawSignal[]> {
  try {
    const query = `
      query LatestPosts {
        posts(order: NEWEST, first: 30) {
          edges {
            node {
              id name tagline description slug createdAt url website
              makers { name username twitterUsername }
              topics { edges { node { name } } }
            }
          }
        }
      }
    `;
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`PH ${res.status}`);
    const data = (await res.json()) as { data: { posts: { edges: PHEdge[] } } };

    return data.data.posts.edges.map((e) => ({
      external_id: `producthunt:${e.node.id}`,
      source: "producthunt" as const,
      source_url: e.node.url,
      source_post_content: `${e.node.name} — ${e.node.tagline}\n\n${e.node.description ?? ""}`,
      source_post_at: e.node.createdAt,
      person_name: e.node.makers[0]?.name,
      company_name: e.node.name,
      website: e.node.website ?? undefined,
      twitter_handle: e.node.makers[0]?.twitterUsername ?? undefined,
      matched_keywords: ["just launched"],
      intent_signal: `Just launched on ProductHunt: ${e.node.tagline}`,
      intent_category: "launching" as const,
      raw: {
        topics: e.node.topics.edges.map((t) => t.node.name),
        makers: e.node.makers,
      },
    }));
  } catch (err) {
    console.error("[producthunt] GraphQL error:", err);
    return fetchViaPublicJson();
  }
}

async function fetchViaPublicJson(): Promise<RawSignal[]> {
  // Fallback: ProductHunt's daily page has a __NEXT_DATA__ blob we could parse,
  // but it's fragile. For now, return empty if no token. We document this in setup.
  console.warn("[producthunt] no PRODUCTHUNT_TOKEN — skipping. Set token for free at https://api.producthunt.com/v2/oauth/applications");
  return [];
}
