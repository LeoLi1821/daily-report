import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "sonnet";

/**
 * Patterns that indicate Anthropic-side throttling (Max subscription
 * 5-hour window exhausted, or rate-limit response). Matching is on the
 * full stderr + final error message so the quota-report script can
 * distinguish quota failures from "timeout" or "bad JSON" failures.
 */
const QUOTA_ERROR_RE =
  /(rate.?limit|usage.?limit|quota|429|too many requests|credit.?balance)/i;

function classifyError(
  stderr: string,
  errMessage: string | null,
): "timeout" | "quota" | "other" | null {
  if (!errMessage && !stderr.trim()) return null;
  const blob = `${stderr}\n${errMessage ?? ""}`;
  if (/timeout/i.test(errMessage ?? "")) return "timeout";
  if (QUOTA_ERROR_RE.test(blob)) return "quota";
  return "other";
}

function logCall(record: {
  ts: string;
  model: string;
  durationMs: number;
  success: boolean;
  inputChars: number;
  outputChars: number;
  errorCategory: "timeout" | "quota" | "other" | null;
  stderrSnippet: string | null;
}): void {
  try {
    fs.mkdirSync("logs", { recursive: true });
    fs.appendFileSync(
      "logs/claude-calls.jsonl",
      JSON.stringify(record) + "\n",
      "utf8",
    );
  } catch {
    // Logging failures must never break the actual LLM pipeline.
  }
}

function resolveCliPath(): string {
  const override = process.env.CLAUDE_CLI_PATH;
  if (override) return override;
  const appdata = process.env.APPDATA;
  if (appdata) return path.join(appdata, "npm", "claude.cmd");
  // Last-resort: rely on PATH lookup.
  return "claude";
}

export interface ClaudeRunResult {
  text: string;
  durationMs: number;
}

export interface ClaudeRunOptions {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

/**
 * Invoke the local `claude` CLI in print mode against the Max subscription.
 * Writes the user prompt over stdin to bypass shell argument length limits.
 *
 * stderr is logged as warnings but not thrown — plugins like claude-mem
 * sometimes emit non-fatal hook errors on stderr that the CLI itself
 * still completes around.
 */
export function runClaudeCli({
  systemPrompt,
  userPrompt,
  timeoutMs = 180_000,
}: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const cli = resolveCliPath();
  const args = [
    "--print",
    "--model",
    CLAUDE_MODEL,
    "--append-system-prompt",
    systemPrompt,
  ];
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      shell: true, // Windows .cmd shims require shell resolution.
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      const success = err === null;
      logCall({
        ts: new Date(started).toISOString(),
        model: CLAUDE_MODEL,
        durationMs,
        success,
        inputChars: systemPrompt.length + userPrompt.length,
        outputChars: stdout.length,
        // Classify only on actual failure — successful calls often have
        // benign stderr (claude-mem SessionEnd hook noise), and tagging
        // those as errors confuses the quota report.
        errorCategory: success ? null : classifyError(stderr, err?.message ?? null),
        stderrSnippet: !success && stderr.trim() ? stderr.trim().slice(0, 200) : null,
      });
      if (err) reject(err);
      else resolve({ text: stdout.trim(), durationMs });
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`claude CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => finish(err));
    child.on("close", (code) => {
      if (stderr.trim()) {
        // eslint-disable-next-line no-console
        console.warn(`[claude-cli] stderr (non-fatal): ${stderr.trim()}`);
      }
      if (code !== 0 && !stdout.trim()) {
        finish(new Error(`claude CLI exited ${code} with empty stdout`));
        return;
      }
      finish(null);
    });

    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}
