import fs from "node:fs";
import path from "node:path";

/**
 * Summarise Claude CLI usage from logs/claude-calls.jsonl — focused on
 * the Max-subscription 5-hour rolling window since that's what actually
 * gates a daily run.
 *
 * Each call is logged by lib/ai/claude-cli.ts after the CLI completes:
 *   { ts, model, durationMs, success, inputChars, outputChars,
 *     errorCategory, stderrSnippet }
 *
 * Usage: npm run quota-report
 */

interface CallRecord {
  ts: string;
  model: string;
  durationMs: number;
  success: boolean;
  inputChars: number;
  outputChars: number;
  errorCategory: "timeout" | "quota" | "other" | null;
  stderrSnippet: string | null;
}

const LOG_PATH = path.join("logs", "claude-calls.jsonl");

// Rough token estimate: Chinese ~1.5 chars/token, English ~4 chars/token.
// We don't know the split per call, so use 3 chars/token as a mixed-corpus
// approximation. Off by 30-40% either way — fine for "are we close to
// the cap" judgement.
const CHARS_PER_TOKEN = 3;

function loadCalls(): CallRecord[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  const raw = fs.readFileSync(LOG_PATH, "utf8");
  const out: CallRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return out;
}

function fmtTokens(chars: number): string {
  const tok = chars / CHARS_PER_TOKEN;
  if (tok >= 1_000_000) return `${(tok / 1_000_000).toFixed(2)}M`;
  if (tok >= 1_000) return `${(tok / 1_000).toFixed(1)}K`;
  return tok.toFixed(0);
}

function fmtTime(ts: string): string {
  // Display local-ish HH:mm — script is for human reading on Windows
  // CLI, no need for full ISO.
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bar(value: number, max: number, width = 24): string {
  const ratio = Math.min(1, value / max);
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function main() {
  const calls = loadCalls();
  if (calls.length === 0) {
    console.log("没有调用记录。先跑一次 `npm run daily` 或任何会调 Claude 的命令。");
    return;
  }

  const now = Date.now();
  const fiveHoursAgo = now - 5 * 3600 * 1000;
  const oneDayAgo = now - 24 * 3600 * 1000;

  const recent5h = calls.filter((c) => new Date(c.ts).getTime() >= fiveHoursAgo);
  const recent24h = calls.filter((c) => new Date(c.ts).getTime() >= oneDayAgo);

  const sumChars = (arr: CallRecord[]) =>
    arr.reduce(
      (acc, c) => {
        acc.input += c.inputChars;
        acc.output += c.outputChars;
        return acc;
      },
      { input: 0, output: 0 },
    );

  // ----- 5-hour rolling window -----
  const w5 = sumChars(recent5h);
  // Max subscription is rate-gated by something like ~880K-1.3M input tokens
  // per 5-hour window (Anthropic doesn't publish exact numbers; this is a
  // community-observed estimate). We use 1.0M as a soft ceiling for the
  // bar — over-shooting means "you might already be throttled".
  const SOFT_CAP_TOK = 1_000_000;

  console.log("");
  console.log("=== Claude CLI usage (本地 logs/claude-calls.jsonl) ===");
  console.log("");
  console.log(`■ 当前 5 小时滚动窗口 (Max 订阅的扣额单位)`);
  console.log(`  调用次数:        ${recent5h.length}`);
  console.log(
    `  累计 input:      ${fmtTokens(w5.input).padStart(7)}  ${bar(w5.input / CHARS_PER_TOKEN, SOFT_CAP_TOK)}  / ~1M 软上限`,
  );
  console.log(`  累计 output:     ${fmtTokens(w5.output).padStart(7)}`);
  if (w5.input / CHARS_PER_TOKEN > SOFT_CAP_TOK * 0.7) {
    console.log(`  ⚠ 已超过软上限 70%，再跑大任务可能会撞 quota`);
  } else if (w5.input / CHARS_PER_TOKEN > SOFT_CAP_TOK * 0.4) {
    console.log(`  ⚪ 处于中段，还有余量`);
  } else {
    console.log(`  ✓ 余量充足`);
  }

  // ----- last 24h -----
  console.log("");
  console.log(`■ 最近 24 小时`);
  const w24 = sumChars(recent24h);
  console.log(`  调用次数:        ${recent24h.length}`);
  console.log(`  input / output:  ${fmtTokens(w24.input)} / ${fmtTokens(w24.output)}`);

  // ----- failures (any time) -----
  const failures = calls.filter((c) => !c.success);
  const quotaFailures = failures.filter((c) => c.errorCategory === "quota");

  console.log("");
  console.log(`■ 累计失败 (全部历史)`);
  console.log(
    `  总失败 ${failures.length}  (quota ${quotaFailures.length} · timeout ${failures.filter((c) => c.errorCategory === "timeout").length} · 其它 ${failures.filter((c) => c.errorCategory === "other" || c.errorCategory === null).length})`,
  );
  if (quotaFailures.length > 0) {
    console.log(`  最近 quota 失败:`);
    for (const f of quotaFailures.slice(-5)) {
      console.log(`    ${fmtTime(f.ts)}  ${f.stderrSnippet?.slice(0, 80) ?? ""}`);
    }
  }

  // ----- last 10 calls -----
  console.log("");
  console.log(`■ 最近 10 次调用 (时间 · 状态 · 时长 · in→out chars)`);
  for (const c of calls.slice(-10)) {
    const status = c.success ? "✓" : `✗ ${c.errorCategory ?? "?"}`;
    console.log(
      `  ${fmtTime(c.ts)}  ${status.padEnd(10)} ${(c.durationMs / 1000).toFixed(1).padStart(5)}s  ` +
        `${c.inputChars.toString().padStart(6)} → ${c.outputChars.toString().padStart(5)}`,
    );
  }

  console.log("");
  console.log(`日志文件: ${LOG_PATH}  (总 ${calls.length} 条)`);
}

main();
