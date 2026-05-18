# Forking & Customization

This project is intentionally easy to fork — most customization is single-file edits. **No code generators, no manifests, no DI containers**.

## Change daily schedule

```bash
node scripts/install.mjs --at 07:30   # re-registers at 07:30 local time
```

Times are local system time. Default is 16:00 (US market close + global news settled). Works on Windows / macOS / Linux.

## Add / remove / disable a source

Edit [`lib/sources/registry.ts`](lib/sources/registry.ts). Each entry:

```ts
{
  id: "my-blog",                          // unique, also used as bucket key
  name: "My Blog",                        // display label
  type: "rss",                            // rss | api | scrape
  url: "https://example.com/feed.xml",
  category: "tech",                       // tech | finance | politics
  subcategory: "ai-news",                 // see SUBCATEGORY_ORDER in render.ts
  enabled: true,
  useCurl: false,                         // true if source blocks Node fetch (Cloudflare TLS fingerprint)
  lang: "en",                             // "zh" skips cnSummary enrichment
}
```

For non-RSS sources (custom JSON API, scraping), create a new file in `lib/sources/`, export a `fetchXxx(sourceId)` function returning `RawArticle[]`, then add a branch in [`lib/sources/dispatch.ts`](lib/sources/dispatch.ts).

## Rename L1 tabs / change order

[`lib/output/render.ts`](lib/output/render.ts):

```ts
const CATEGORY_LABELS: Record<Category, string> = {
  tech: "技术动态",        // ← rename here
  finance: "财经要点",
  politics: "时政观察",
};
```

L1 panel order is hardcoded in `renderHtml()` (search for `<nav class="tabs">`). Reorder the `<button>` lines.

## Add a new L2 subcategory under tech

1. In `registry.ts`: tag sources with `subcategory: "my-new-sub"`
2. In `render.ts`:
   - Add `"my-new-sub"` to `SUBCATEGORY_ORDER.tech`
   - Add `"my-new-sub": "我的新栏目"` to `SUBCATEGORY_LABELS`
   - Add to `TECH_MAIN_SUBS` (or `TECH_COMMUNITY_SUBS` for community panel) — controls which L1 panel renders it
   - Optionally: `SOURCE_DISPLAY_LIMITS["tech:my-new-sub"]` for per-source cap
   - Optionally: `MERGED_SUBGROUP_LIMITS["tech:my-new-sub"]` to merge sources into single time-sorted list

## Add Chinese summary enrichment for a new subcategory

1. In [`lib/ai/enrich.ts`](lib/ai/enrich.ts), copy the `XVIRAL_SYSTEM_PROMPT` block and adjust:
   - The system prompt (writing style, output structure)
   - Add an `enrichXxxSummaries()` function calling `runEnrichment(payload, MY_PROMPT, "scope label")`
2. In [`scripts/daily.ts`](scripts/daily.ts):
   - Add an `enrichXxx(articles)` wrapper that filters to your subcategory and calls the function from step 1
   - Add `await enrichXxx(articles)` to the `main()` enrichment chain

## Adjust HTML styling

All CSS is inline inside `renderHtml()` in [`lib/output/render.ts`](lib/output/render.ts). Search for `<style>` and edit. After saving, `npm run render` (1 second) regenerates the latest HTML using cached article data — no LLM cost.

## Change trading watchlist

[`lib/trading/watchlist.ts`](lib/trading/watchlist.ts) — `WATCHLIST` array. Each entry:

```ts
{ symbol: "AAPL", displayName: "苹果", group: "us-equity" }
```

Valid `group` values are in `AssetGroup` (same file): `us-equity` / `crypto` / `china-equity` / `commodity-fx` / `macro`. The L2 trading sub-tabs render groups in `ASSET_GROUP_ORDER` order.

## Disable trading section entirely

Comment out the `runTrading()` call near the end of [`scripts/daily.ts`](scripts/daily.ts) `main()`. The report will skip the "市场行情" L1 tab.

## Disable a whole category

Two ways:
- **Set all its sources to `enabled: false`** in registry — category disappears automatically (empty)
- **Remove the L1 panel from `renderHtml()`** — search for `data-panel="finance"` and delete that `<button>` + `<section>`

## Change LLM provider

The project assumes [claude CLI](https://github.com/anthropics/claude-code) is installed and logged in. All LLM calls funnel through [`lib/ai/claude-cli.ts`](lib/ai/claude-cli.ts) `runClaudeCli()`.

To use a different provider:
- Swap `runClaudeCli` body for `fetch('https://api.openai.com/...')` or similar
- Note: this loses the Max-subscription cost model — you'll pay per-token

Don't try to do this casually. The prompts assume Sonnet's strengths (Chinese fluency, structured JSON output, long context). Other models may need prompt adjustments.

## Configure secrets

Currently the project needs ZERO secrets — everything works out of `claude` CLI being logged in. If you add a paid data source (e.g. Bloomberg API):

1. Create `.env.local` at project root (gitignored)
2. Add `MY_API_KEY=...`
3. Project already loads it via `dotenv` in [`scripts/daily.ts`](scripts/daily.ts)

## Debug a failed run

```powershell
# What was the last result?
Get-ScheduledTaskInfo -TaskName DailyBrief | Format-List LastRunTime, LastTaskResult

# Tail today's log
Get-Content logs\daily-(Get-Date -Format yyyy-MM-dd).log -Tail 50

# Check LLM call history
npm run quota-report
```

Decode `LastTaskResult`:
- `0` = success
- `267009` = currently running
- `267011` = never run
- Anything else = error code; check log

If the task didn't fire at all: ensure Task Scheduler service is running, your Windows user account was logged in at trigger time (or `StartWhenAvailable` will catch up after next login), and `WakeToRun` works on your hardware.

## Run without Task Scheduler

```powershell
npm run daily                  # foreground, ~5-8 min, blocks the shell
```

Or schedule with your own tooling (cron, Linux systemd timer, macOS launchd) — call `npm run daily` from the project root.
