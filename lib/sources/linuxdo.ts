import { curlFetch } from "./curl-fetch";
import type { RawArticle } from "./types";
import { V2EX_OFF_TOPIC_RE } from "./v2ex";

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  posts_count?: number;
  views?: number;
  like_count?: number;
  created_at?: string;
  last_posted_at?: string;
  excerpt?: string;
}

interface DiscourseListing {
  topic_list?: { topics?: DiscourseTopic[] };
}

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

/**
 * Cloudflare's "Just a moment…" interstitial responds with HTML instead
 * of JSON. Detect it explicitly so the caller doesn't waste a JSON.parse
 * SyntaxError on what's really a WAF block.
 */
function isCloudflareChallenge(text: string): boolean {
  const head = text.slice(0, 500).toLowerCase();
  return (
    head.startsWith("<") ||
    head.includes("just a moment") ||
    head.includes("cf-chl") ||
    head.includes("cloudflare")
  );
}

async function fetchListing(url: string): Promise<DiscourseTopic[]> {
  const text = await curlFetch(url, HEADERS);
  if (isCloudflareChallenge(text)) {
    throw new Error("cloudflare challenge page");
  }
  const data = JSON.parse(text) as DiscourseListing;
  return data?.topic_list?.topics ?? [];
}

/**
 * LinuxDo is a public Discourse instance behind Cloudflare. Cloudflare
 * TLS-fingerprints Node's undici and serves a challenge page, so we
 * shell out to curl. See lib/sources/curl-fetch.ts for the rationale.
 *
 * Reliability: try /top.json then /latest.json once each. We deliberately
 * AVOID aggressive retry / UA rotation here — observed empirically that
 * burst requests from a datacenter IP make Cloudflare's WAF flag the IP
 * harder, escalating from intermittent challenge to persistent block.
 * Better to fail this single source quietly and let daily.ts continue.
 */
export async function fetchLinuxDo(
  sourceId: string,
  limit = 25,
): Promise<RawArticle[]> {
  let topics: DiscourseTopic[] = [];

  try {
    topics = await fetchListing("https://linux.do/top.json?period=daily");
  } catch {
    // fall through to latest
  }

  if (topics.length === 0) {
    topics = await fetchListing("https://linux.do/latest.json");
  }

  return topics
    .filter((t) => t.title && t.id && !V2EX_OFF_TOPIC_RE.test(t.title))
    .slice(0, limit)
    .map((t) => ({
      sourceId,
      title: t.title,
      url: `https://linux.do/t/${t.slug ?? "topic"}/${t.id}`,
      excerpt: t.excerpt
        ? t.excerpt.replace(/\s+/g, " ").trim().slice(0, 300)
        : `${t.views ?? 0} 浏览 · ${t.posts_count ?? 0} 回复 · ${t.like_count ?? 0} 点赞`,
      publishedAt: t.created_at ? new Date(t.created_at) : undefined,
      category: "tech" as const,
    }));
}
