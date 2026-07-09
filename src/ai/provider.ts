import { env, capabilities } from "@/env";

/**
 * AI provider with DeepSeek primary → Claude Sonnet fallback.
 *
 * Both are called via their HTTP APIs directly (no SDK dependency) so the
 * bundle stays light and the fallback logic is explicit. Every v1 prompt is
 * JSON-out; `generateJson` enforces parsing and retries the fallback provider
 * on failure (network error, non-2xx, or unparseable JSON).
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AIError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}

async function callDeepSeek(messages: ChatMessage[], opts: GenOpts): Promise<string> {
  if (!capabilities.hasDeepSeek) throw new AIError("DeepSeek key missing", "deepseek");
  const res = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1500,
      response_format: opts.json ? { type: "json_object" } : undefined,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (!res.ok) {
    throw new AIError(`DeepSeek ${res.status}: ${await res.text()}`, "deepseek");
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AIError("DeepSeek returned empty content", "deepseek");
  return content;
}

async function callClaude(messages: ChatMessage[], opts: GenOpts): Promise<string> {
  if (!capabilities.hasClaude) throw new AIError("Anthropic key missing", "claude");
  // Anthropic Messages API takes system separately from the turn list.
  const system = messages.find((m) => m.role === "system")?.content;
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      system: opts.json
        ? `${system ?? ""}\n\nRespond with ONLY valid JSON. No prose, no code fences.`
        : system,
      messages: turns,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.8,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (!res.ok) {
    throw new AIError(`Claude ${res.status}: ${await res.text()}`, "claude");
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  const content = data.content?.map((c) => c.text ?? "").join("");
  if (!content) throw new AIError("Claude returned empty content", "claude");
  return content;
}

export type GenOpts = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  json?: boolean;
};

/** Raw text generation with provider fallback. */
export async function generateText(messages: ChatMessage[], opts: GenOpts = {}): Promise<string> {
  if (!capabilities.hasAnyAI) {
    throw new AIError(
      "No AI provider configured. Set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY.",
      "none",
    );
  }
  const errors: unknown[] = [];
  // Primary
  if (capabilities.hasDeepSeek) {
    try {
      return await callDeepSeek(messages, opts);
    } catch (e) {
      errors.push(e);
      console.warn("[ai] DeepSeek failed, falling back to Claude:", (e as Error).message);
    }
  }
  // Fallback
  if (capabilities.hasClaude) {
    try {
      return await callClaude(messages, opts);
    } catch (e) {
      errors.push(e);
    }
  }
  throw new AIError(`All AI providers failed: ${errors.map((e) => String(e)).join("; ")}`, "all");
}

/** Extract a JSON object from a model response that may include stray text/fences. */
export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  // Strip code fences if present.
  const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(fenced) as T;
  } catch {
    // Fall back to grabbing the first {...} or [...] block.
    const match = fenced.match(/[{[][\s\S]*[}\]]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new AIError(`Response was not valid JSON: ${raw.slice(0, 200)}`, "parse");
  }
}

/**
 * JSON generation with provider fallback AND parse-retry: if the primary
 * returns unparseable JSON, we retry once on the fallback before throwing.
 */
export async function generateJson<T>(messages: ChatMessage[], opts: GenOpts = {}): Promise<T> {
  const jsonOpts = { ...opts, json: true };
  const raw = await generateText(messages, jsonOpts);
  try {
    return extractJson<T>(raw);
  } catch (parseErr) {
    // One retry against Claude specifically if available and not already used.
    if (capabilities.hasClaude) {
      const retry = await callClaude(messages, jsonOpts);
      return extractJson<T>(retry);
    }
    throw parseErr;
  }
}
