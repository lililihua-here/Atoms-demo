// lib/llm/async_llm.ts
import Anthropic from "@anthropic-ai/sdk";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return _anthropic;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 3;

export interface LLMCallOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  max_tokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  content: string;
  usage: { input_tokens: number; output_tokens: number };
}

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "message_stop" };

// Non-streaming call (for summaries, embeddings, single-component gen)
export async function callLLM(opts: LLMCallOptions): Promise<LLMCallResult> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await getAnthropic().messages.create({
        model: DEFAULT_MODEL,
        max_tokens: opts.max_tokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        system: opts.system,
        messages: opts.messages,
      });
      const textBlock = res.content.find((b) => b.type === "text");
      return {
        content: textBlock && "text" in textBlock ? textBlock.text : "",
        usage: {
          input_tokens: res.usage.input_tokens,
          output_tokens: res.usage.output_tokens,
        },
      };
    } catch (e: any) {
      lastError = e;
      if (e.status !== 429 && e.status < 500) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("LLM call failed");
}

// Streaming call (for agent generation)
export async function* streamLLM(
  opts: LLMCallOptions
): AsyncGenerator<StreamEvent> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const stream = getAnthropic().messages.stream({
        model: DEFAULT_MODEL,
        max_tokens: opts.max_tokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        system: opts.system,
        messages: opts.messages,
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          "text" in event.delta
        ) {
          yield { type: "text_delta", text: event.delta.text };
        }
      }
      yield { type: "message_stop" };
      return;
    } catch (e: any) {
      lastError = e;
      if (e.status !== 429 && e.status < 500) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Streaming LLM call failed");
}

// Generate a summary (non-streaming, short output)
export async function summarize(
  content: string,
  systemPrompt: string
): Promise<string> {
  const result = await callLLM({
    system: systemPrompt,
    messages: [{ role: "user", content }],
    max_tokens: 300,
    temperature: 0.3,
  });
  return result.content.trim();
}
