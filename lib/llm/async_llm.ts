// lib/llm/async_llm.ts
import OpenAI from "openai";

const DEPLOY_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: requireEnv("DEEPSEEK_API_KEY"),
      baseURL: DEPLOY_URL,
    });
  }
  return _client;
}

const DEFAULT_MODEL = process.env.LLM_MODEL || "deepseek-chat";
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
  | { type: "message_stop" }
  | { type: "usage"; input_tokens: number; output_tokens: number };

// OpenAI-compatible messages include system as a role
function buildMessages(opts: LLMCallOptions): OpenAI.ChatCompletionMessageParam[] {
  const msgs: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
  ];
  for (const m of opts.messages) {
    msgs.push({ role: m.role, content: m.content });
  }
  return msgs;
}

// Non-streaming call (for summaries, embeddings, single-component gen)
export async function callLLM(opts: LLMCallOptions): Promise<LLMCallResult> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await getClient().chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: opts.max_tokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        messages: buildMessages(opts),
      });
      return {
        content: res.choices[0]?.message?.content || "",
        usage: {
          input_tokens: res.usage?.prompt_tokens || 0,
          output_tokens: res.usage?.completion_tokens || 0,
        },
      };
    } catch (e: any) {
      lastError = e;
      // Only retry on rate limit (429) or server errors (5xx)
      if (e.status !== 429 && (e.status < 500 || !e.status)) throw e;
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
      const stream = await getClient().chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: opts.max_tokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        messages: buildMessages(opts),
        stream: true,
        stream_options: { include_usage: true },
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "text_delta", text: delta };
        }
        if (chunk.usage) {
          yield {
            type: "usage",
            input_tokens: chunk.usage.prompt_tokens || 0,
            output_tokens: chunk.usage.completion_tokens || 0,
          };
        }
      }
      yield { type: "message_stop" };
      return;
    } catch (e: any) {
      lastError = e;
      if (e.status !== 429 && (e.status < 500 || !e.status)) throw e;
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
