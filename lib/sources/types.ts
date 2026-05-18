export type Category = "tech" | "finance" | "politics";
export type SourceType = "rss" | "api" | "scrape";

export interface SourceDef {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  category: Category;
  /**
   * Group key within a category. Render order/labels are defined per
   * category in lib/output/render.ts. Categories without a registered
   * order render flat (no L2 tabs).
   */
  subcategory?: string;
  /**
   * When true, the rss fetcher shells out to curl instead of using
   * Node's undici. Required for hosts that TLS-fingerprint Node
   * (Cloudflare's "Just a moment…" challenge — LinuxDo, Reddit, etc.)
   */
  useCurl?: boolean;
  enabled?: boolean;
  /**
   * Source content language. Default treated as "en". When "zh", the
   * cnSummary enrichment step skips this source — its content is already
   * in Chinese, so an LLM summary would just be a slightly-shorter rewrite.
   */
  lang?: "zh" | "en";
}

export interface RawArticle {
  sourceId: string;
  title: string;
  url: string;
  excerpt?: string;
  publishedAt?: Date;
  category: Category;
  cnSummary?: string;
  /**
   * Structured one-line metadata to display above the excerpt — currently
   * used by GitHub Trending for "Language · ★stars · forks · stars today".
   */
  meta?: string;
}
