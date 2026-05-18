import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";

import { enrichFinanceNewsSummaries } from "../lib/ai/enrich";
import type { ArticleInput } from "../lib/ai/pipeline";
import { sources } from "../lib/sources/registry";
import {
  MERGED_SUBGROUP_LIMITS,
  isSportsArticle,
} from "../lib/output/render";
import { todayKey } from "../lib/utils";

const OUTPUT_DIR = "daily_reports";

/**
 * Top up missing cnSummary fields on the sidecar without re-running the
 * full daily pipeline. Useful when MERGED_SUBGROUP_LIMITS bumps up
 * (e.g. politics 10 → 15) and the previous enrichment only covered
 * the old top-N.
 *
 * Usage:
 *   npm run regen-enrich -- politics:world
 *   npm run regen-enrich -- finance:news 2026-05-15
 *
 * Follow up with `npm run render` to refresh HTML.
 */
async function main() {
  const target = process.argv[2];
  const date = process.argv[3] || todayKey();
  if (!target || !target.includes(":")) {
    throw new Error(
      `Usage: tsx scripts/regen-enrich.ts <category:subcategory> [date]`,
    );
  }
  const [category, subcategory] = target.split(":") as [
    "tech" | "finance" | "politics",
    string,
  ];
  if (
    category !== "tech" &&
    category !== "finance" &&
    category !== "politics"
  ) {
    throw new Error(`Unknown category: ${category}`);
  }

  const sidecarPath = path.join(OUTPUT_DIR, `${date}-articles.json`);
  if (!fs.existsSync(sidecarPath)) {
    throw new Error(`Sidecar not found: ${sidecarPath}`);
  }
  const data = JSON.parse(fs.readFileSync(sidecarPath, "utf8")) as {
    date: string;
    articles: ArticleInput[];
  };

  const subSources = sources.filter(
    (s) =>
      s.category === category &&
      s.subcategory === subcategory &&
      s.enabled !== false,
  );
  const enabledIds = new Set(subSources.map((s) => s.id));
  const zhOnlyIds = new Set(
    subSources.filter((s) => s.lang === "zh").map((s) => s.id),
  );
  const limit = MERGED_SUBGROUP_LIMITS[`${category}:${subcategory}`] ?? 12;
  const top = data.articles
    .filter((a) => enabledIds.has(a.sourceId))
    .filter((a) => category !== "politics" || !isSportsArticle(a.title))
    .sort((a, b) => {
      const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);

  const missing = top
    .filter((a) => !zhOnlyIds.has(a.sourceId))
    .filter((a) => !a.cnSummary);
  console.log(
    `[regen-enrich] ${target}: top ${top.length}, missing cnSummary on ${missing.length}`,
  );
  if (missing.length === 0) {
    console.log("[regen-enrich] nothing to do.");
    return;
  }

  const t0 = Date.now();
  const summaries = await enrichFinanceNewsSummaries(missing);
  console.log(
    `[regen-enrich] enrichment done in ${((Date.now() - t0) / 1000).toFixed(1)}s, matched ${summaries.size}/${missing.length}`,
  );

  let patched = 0;
  for (const a of data.articles) {
    const s = summaries.get(a.url);
    if (s && !a.cnSummary) {
      a.cnSummary = s;
      patched++;
    }
  }
  fs.writeFileSync(sidecarPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[regen-enrich] patched ${patched} articles in ${sidecarPath}`);
  console.log(`[regen-enrich] now run \`npm run render\` to refresh HTML.`);
}

main().catch((e) => {
  console.error("[regen-enrich] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
