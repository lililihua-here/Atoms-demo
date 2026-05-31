// lib/agent/stream-agent.ts
import { streamLLM, callLLM } from "@/lib/llm/async_llm";
import { resolveToolCalls } from "./mcp";
import type { AgentRole, PipelineCallbacks } from "@/lib/models/types";

// Streaming agent call — accumulates full output, calls onChunk with accumulated text
export function streamAgent(
  stage: AgentRole,
  system: string,
  userContent: string,
  cbs: PipelineCallbacks
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let acc = "";
    cbs.onStageStart(stage);
    try {
      // Stage-specific token limits to stay under Vercel 60s timeout
      const stageMaxTokens: Record<string, number> = { pm: 500, architect: 3000, engineer: 4096 };
      for await (const event of streamLLM({
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: stageMaxTokens[stage] ?? 2048,
        temperature: 0.3,
      })) {
        if (event.type === "text_delta") {
          acc += event.text;
          cbs.onChunk(stage, acc);
        }
        if (event.type === "message_stop") break;
      }
      // Resolve MCP tool calls
      try {
        const resolved = await resolveToolCalls(acc);
        if (resolved) acc += resolved;
      } catch {}
      resolve(acc);
    } catch (e: any) {
      cbs.onError(stage, e.message || "Agent generation failed");
      reject(e);
    }
  });
}

// Non-streaming single component generation for parallel Engineer sub-agents
export async function genComponent(system: string, userContent: string): Promise<string> {
  const result = await callLLM({
    system,
    messages: [{ role: "user", content: userContent }],
    max_tokens: 4096,
    temperature: 0.3,
  });
  return result.content;
}

// Promise.race-based timeout
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    ),
  ]);
}

// Bounded-concurrency promise pool
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<string>
): Promise<PromiseSettledResult<string>[]> {
  const results: PromiseSettledResult<string>[] = new Array(items.length);
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    const current = cursor++;
    if (current >= items.length) return;
    try {
      const value = await worker(items[current], current);
      results[current] = { status: "fulfilled", value };
    } catch (reason) {
      results[current] = { status: "rejected", reason };
    }
    await runNext();
  };
  const pool = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(pool);
  return results;
}

// Shared utilities from architect contract (used by buildSubtaskContent)
export const architectContractUtilities: any[] = [];
