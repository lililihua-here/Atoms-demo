// lib/agent/embedding.ts
import { callLLM } from "@/lib/llm/async_llm";

const EMBED_DIM = 64;

// FNV hash-based deterministic fallback embedding
function hashEmbed(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0);
  let h = 0x811c9dc5;
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    vec[i % EMBED_DIM] += (h >>> 0) / 0xffffffff;
  }
  return normalize(vec);
}

// L2 normalization
export function normalize(vec: number[]): number[] {
  const sumSq = vec.reduce((s, v) => s + v * v, 0);
  const len = Math.sqrt(sumSq);
  if (len === 0) return vec.map(() => 1 / Math.sqrt(EMBED_DIM));
  return vec.map((v) => v / len);
}

// Cosine similarity of two normalized vectors
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

// JSON round-trip for vectors
export function serializeVector(v: number[]): string {
  return JSON.stringify(v);
}

export function parseVector(s: string | null): number[] | null {
  if (!s) return null;
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr) && arr.length === EMBED_DIM) return arr;
  } catch {}
  return null;
}

// Generate embedding via LLM
export async function embedText(text: string): Promise<number[] | null> {
  const prompt = `输出一个 ${EMBED_DIM} 维的归一化数值向量(JSON 数组格式),用来表示以下文本的语义。只输出 JSON 数组,不要任何其他文字。\n\n文本: ${text}`;

  // First attempt
  try {
    const result = await callLLM({
      system: "You are a text embedding model. Output ONLY a JSON array of numbers.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0,
    });
    const vec = parseVector(result.content);
    if (vec) return vec;
    // One repair retry
    const retryResult = await callLLM({
      system: "Output ONLY a valid JSON array of 64 numbers. No explanation.",
      messages: [{ role: "user", content: `Parse failed. Re-output the vector as ONLY a JSON array: ${text.substring(0, 200)}` }],
      max_tokens: 2048,
      temperature: 0,
    });
    const retryVec = parseVector(retryResult.content);
    if (retryVec) return retryVec;
  } catch {}

  // FNV hash fallback
  return hashEmbed(text);
}

export { EMBED_DIM, hashEmbed };
