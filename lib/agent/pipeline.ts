// lib/agent/pipeline.ts
import { createServerSupabase } from "@/lib/supabase/server";
import { streamLLM, callLLM, summarize as summarizeLLM } from "@/lib/llm/async_llm";
import { PM_SYSTEM, ARCHITECT_SYSTEM, ENGINEER_SYSTEM, SUMMARY_SYSTEM, MCP_TOOLS_NOTE } from "./prompts";
import { retrieve, formatRetrievedContext } from "./retrieval";
import { embedText, serializeVector } from "./embedding";
import { extractContract, buildSubtasks } from "./contract";
import { mergeComponents, validateSyntax } from "./merge";
import { buildToolCatalog, renderToolCatalog, resolveToolCalls } from "./mcp";
import type { AgentRole, AgentDocument, PipelineCallbacks, PipelineContext, ParallelTaskState } from "@/lib/models/types";
import { classifyIntent } from "./classify";

const STAGE_ORDER: AgentRole[] = ["pm", "architect", "engineer"];
const ROLE_LABELS: Record<AgentRole, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
};
const ROLE_SYSTEM: Record<AgentRole, string> = {
  pm: PM_SYSTEM,
  architect: ARCHITECT_SYSTEM,
  engineer: ENGINEER_SYSTEM,
};

const ENGINEER_CONCURRENCY = 3;
const SUBTASK_TIMEOUT_MS = 120_000;
const MIN_LEAVES_FOR_PARALLEL = 2;

// Load project history and detect breakpoint resume
export async function loadHistory(projectId: string) {
  const supabase = createServerSupabase();
  const { data: docs } = await supabase
    .from("agent_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("round", { ascending: true })
    .order("created_at", { ascending: true });

  if (!docs || docs.length === 0) return { docs: [], resumeRole: null, maxRound: 0 };

  const typedDocs = docs as AgentDocument[];
  const validDocs = typedDocs.filter((d: any) => String(d.project_id) === String(projectId));

  const byRound = new Map<number, AgentDocument[]>();
  for (const doc of validDocs) {
    const list = byRound.get(doc.round) || [];
    list.push(doc);
    byRound.set(doc.round, list);
  }

  const maxRound = Math.max(...Array.from(byRound.keys()));
  const latestRound = byRound.get(maxRound) || [];
  const rolesInRound = new Set(latestRound.map((d) => d.agent_role));

  let resumeRole: AgentRole | null = null;
  for (const role of STAGE_ORDER) {
    if (!rolesInRound.has(role)) {
      resumeRole = role;
      break;
    }
  }

  return { docs: validDocs, resumeRole, maxRound };
}

// Build context for a single stage
function buildUserContent(
  stage: AgentRole,
  ctx: PipelineContext,
  allDocs: AgentDocument[],
  retrievedContext: string,
  toolCatalog: string,
  toolResults: string
): string {
  const parts: string[] = [];

  parts.push(`## 用户需求\n${ctx.userMessage}`);

  const prevSummaries = allDocs
    .filter((d) =>
      d.round < ctx.round ||
      (d.round === ctx.round && STAGE_ORDER.indexOf(d.agent_role as AgentRole) < STAGE_ORDER.indexOf(stage))
    )
    .map((d) => `[${ROLE_LABELS[d.agent_role as AgentRole] ?? d.agent_role}] ${d.summary}`);

  if (prevSummaries.length > 0) {
    parts.push(`## 历史协作摘要\n${prevSummaries.join("\n\n")}`);
  }

  if (retrievedContext.trim()) {
    parts.push(retrievedContext.trim());
  }

  if (toolCatalog.trim()) {
    parts.push(toolCatalog.trim() + MCP_TOOLS_NOTE);
  }

  if (toolResults.trim()) {
    parts.push(`## 已执行的 MCP 工具结果\n${toolResults.trim()}`);
  }

  // For iteration: inject previous code so engineer can modify instead of rewrite
  if (ctx.round > 0 && stage === "engineer" && ctx.previousCode) {
    parts.push(`## 当前应用的完整代码（请在此基础上修改，不要重写整个应用）
\`\`\`jsx
${ctx.previousCode}
\`\`\`

## 用户修改要求
${ctx.userMessage}

请只做用户要求的改动，保持其他部分完全不变。`);
  }

  return parts.join("\n\n");
}

// Streaming agent call — accumulates full output, calls onChunk with accumulated text
function streamAgent(
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
      const stageMaxTokens: Record<string, number> = { pm: 500, architect: 1000, engineer: 4096 };
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
async function genComponent(system: string, userContent: string): Promise<string> {
  const result = await callLLM({
    system,
    messages: [{ role: "user", content: userContent }],
    max_tokens: 4096,
    temperature: 0.3,
  });
  return result.content;
}

// Promise.race-based timeout
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    ),
  ]);
}

// Bounded-concurrency promise pool
async function runWithConcurrency<T>(
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
let architectContractUtilities: any[] = [];

// Attempt parallel Engineer flow. Returns merged code on success, null to signal fallback to serial.
async function runEngineerParallel(
  architectOutput: string,
  architectSummary: string,
  ctx: PipelineContext,
  allDocs: AgentDocument[],
  cbs: PipelineCallbacks
): Promise<string | null> {
  const contract = extractContract(architectOutput);
  if (!contract) { console.log("runEngineerParallel: no valid contract in architect output"); return null; }
  const subtasks = buildSubtasks(contract);
  if (subtasks.length < MIN_LEAVES_FOR_PARALLEL) {
    console.log("runEngineerParallel: only", subtasks.length, "parallelizable leaves, need", MIN_LEAVES_FOR_PARALLEL);
    return null;
  }

  architectContractUtilities = contract.shared_utilities || [];

  cbs.onParallelStart(subtasks.map((t) => ({
    componentName: t.componentName,
    status: "running",
  })));

  const settled = await runWithConcurrency(
    subtasks,
    ENGINEER_CONCURRENCY,
    async (task) => {
      const userContent = buildSubtaskContent(task, ctx, allDocs, architectSummary);
      return withTimeout(
        genComponent(ENGINEER_SYSTEM, userContent),
        SUBTASK_TIMEOUT_MS,
        `Component ${task.componentName}`
      );
    }
  );

  const results: { componentName: string; output: string; ok: boolean }[] = subtasks.map((task, i) => {
    const r = settled[i];
    if (r && r.status === "fulfilled") {
      cbs.onParallelUpdate({ componentName: task.componentName, status: "success" });
      return { componentName: task.componentName, output: r.value, ok: true };
    }
    cbs.onParallelUpdate({ componentName: task.componentName, status: "failed" });
    return { componentName: task.componentName, output: "", ok: false };
  });

  const failed = results.filter((r) => !r.ok).length;
  if (failed * 2 > results.length) {
    cbs.onParallelEnd();
    return null; // Majority failure → fallback to serial
  }

  const merged = mergeComponents(results, contract);
  if (!validateSyntax(merged)) {
    cbs.onParallelEnd();
    return null;
  }

  // Check that we got at least one real component function (not just placeholders)
  const realCount = contract.components
    .filter((c) => c.type === "leaf")
    .filter((c) => merged.includes(`function ${c.name}`)).length;
  if (realCount === 0) {
    console.log("All parallel components are placeholders, falling back to serial");
    cbs.onParallelEnd();
    return null;
  }

  for (const r of results) {
    if (!r.ok) cbs.onParallelUpdate({ componentName: r.componentName, status: "placeholder" });
  }
  cbs.onParallelEnd();
  return merged;
}

function buildSubtaskContent(
  task: any,
  ctx: PipelineContext,
  allDocs: AgentDocument[],
  architectSummary: string
): string {
  const parts: string[] = [];
  parts.push(`## 单组件任务\n组件名: ${task.componentName}\n\n${task.prompt}`);
  const pmSummary = allDocs.find((d) => d.agent_role === "pm")?.summary;
  if (pmSummary) parts.push(`## 产品背景\n${pmSummary}`);
  if (architectSummary) parts.push(`## 设计约束\n${architectSummary.slice(0, 1200)}`);
  return parts.join("\n\n");
}

// Extract JSX code from markdown output
export function extractCode(markdown: string): string | null {
  if (!markdown) return null;

  // Try fenced code block with language specifier
  let m = markdown.match(/```(?:jsx|js|javascript|tsx|react)\s*\n([\s\S]*?)```/i);
  if (m && m[1] && m[1].trim().length > 20) {
    console.log("extractCode: found fenced block with lang, length:", m[1].trim().length);
    return m[1].trim();
  }

  // Try any fenced block (no language specifier)
  m = markdown.match(/```\s*\n([\s\S]*?)```/);
  if (m && m[1] && m[1].trim().length > 20) {
    console.log("extractCode: found fenced block without lang, length:", m[1].trim().length);
    return m[1].trim();
  }

  // Try to extract from "function App" or "const App" — remove markdown around it
  const appIdx = markdown.search(/(?:^|\n)\s*(?:function\s+App\s*\(|const\s+App\s*=)/m);
  if (appIdx >= 0) {
    const code = markdown.substring(appIdx).trim();
    console.log("extractCode: raw app code detected, length:", code.length);
    return code;
  }

  // Last resort: any function definition (for single-component mode)
  const fnIdx = markdown.search(/(?:^|\n)\s*function\s+\w+\s*\(/m);
  if (fnIdx >= 0) {
    const code = markdown.substring(fnIdx).trim();
    console.log("extractCode: raw function detected, length:", code.length);
    return code;
  }

  console.log("extractCode: no code found in output. First 200 chars:", markdown.substring(0, 200));
  return null;
}

// Persist one stage's output to Supabase
async function persistStage(
  stage: AgentRole,
  output: string,
  summary: string,
  ctx: PipelineContext
): Promise<AgentDocument> {
  const supabase = createServerSupabase();
  const embedding = await embedText(summary);
  const tags = stage === "pm" ? [ctx.userMessage] : [];

  const { data } = await supabase
    .from("agent_documents")
    .insert({
      project_id: ctx.projectId,
      agent_role: stage,
      content: output,
      summary,
      tags,
      round: ctx.round,
      embedding_json: embedding ? serializeVector(embedding) : null,
    })
    .select()
    .single();

  return data as AgentDocument;
}

// Main pipeline entry point
export async function runPipeline(
  ctx: PipelineContext,
  cbs: PipelineCallbacks,
  roles?: AgentRole[]
): Promise<{
  pmContent: string; pmSummary: string;
  architectContent: string; architectSummary: string;
  engineerContent: string; engineerSummary: string;
  code: string | null;
}> {
  const { docs, resumeRole } = await loadHistory(ctx.projectId);

  const outputs: Partial<Record<AgentRole, string>> = {};
  const summaries: Partial<Record<AgentRole, string>> = {};

  // Build MCP tool catalog once
  let toolCatalog = "";
  try {
    const { tools } = await buildToolCatalog();
    if (tools.length > 0) toolCatalog = renderToolCatalog(tools);
  } catch {}

  let accumulatedToolResults = "";

  // Semantic retrieval for this round
  let retrievedContext = "";
  try {
    const retrieved = await retrieve(ctx.userMessage, ctx.projectId);
    cbs.onRetrieve(retrieved);
    retrievedContext = formatRetrievedContext(retrieved);
  } catch {}

  const allowedRoles = roles || STAGE_ORDER;
  const startIndex = resumeRole ? STAGE_ORDER.indexOf(resumeRole) : 0;
  // Only run roles that are both allowed and at or after the resume point
  const rolesToRun = allowedRoles.filter(
    (r) => STAGE_ORDER.indexOf(r) >= startIndex
  );

  console.log("runPipeline: roles =", rolesToRun.map(r => r));

  for (const role of rolesToRun) {
    const userContent = buildUserContent(
      role, ctx, docs,
      retrievedContext, toolCatalog, accumulatedToolResults
    );

    if (role === "engineer") {
      // Try parallel component-level generation first
      let mergedCode: string | null = null;
      try {
        mergedCode = await runEngineerParallel(
          outputs.architect || "",
          summaries.architect || "",
          ctx, docs, cbs
        );
      } catch {
        cbs.onParallelEnd();
      }

      let content: string;
      if (mergedCode) {
        content = `> 已通过组件级并行生成并合并代码。\n\n\`\`\`jsx\n${mergedCode}\n\`\`\``;
        cbs.onChunk(role, content);
      } else {
        // Fallback to serial full-app Engineer
        content = await streamAgent(role, ROLE_SYSTEM[role], userContent, cbs);
      }

      outputs[role] = content;
      const summary = await summarizeLLM(content, SUMMARY_SYSTEM);
      summaries[role] = summary;
      const doc = await persistStage(role, content, summary, ctx);
      cbs.onStagePersist(role, doc);
      cbs.onStageComplete(role, content, summary);

      const code = extractCode(content);
      if (code) {
        console.log("runPipeline: code extracted, length:", code.length);
        cbs.onCode(code);
      } else {
        console.log("runPipeline: extractCode failed, engineer output first 300 chars:", content.substring(0, 300));
        cbs.onError(role, "未能从工程师输出中提取到代码块");
      }
    } else {
      const content = await streamAgent(role, ROLE_SYSTEM[role], userContent, cbs);
      outputs[role] = content;
      const summary = await summarizeLLM(content, SUMMARY_SYSTEM);
      summaries[role] = summary;

      // Resolve MCP tool calls from non-engineer stages
      try {
        const toolOut = await resolveToolCalls(content);
        if (toolOut && toolOut.trim()) {
          accumulatedToolResults = accumulatedToolResults
            ? `${accumulatedToolResults}\n\n${toolOut}`
            : toolOut;
        }
      } catch {}

      const doc = await persistStage(role, content, summary, ctx);
      cbs.onStagePersist(role, doc);
      cbs.onStageComplete(role, content, summary);
    }
  }

  return {
    pmContent: outputs.pm || "",
    pmSummary: summaries.pm || "",
    architectContent: outputs.architect || "",
    architectSummary: summaries.architect || "",
    engineerContent: outputs.engineer || "",
    engineerSummary: summaries.engineer || "",
    code: extractCode(outputs.engineer || ""),
  };
}
