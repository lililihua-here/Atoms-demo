// lib/agent/pipeline.ts
import { createServerSupabase } from "@/lib/supabase/server";
import { summarize as summarizeLLM } from "@/lib/llm/async_llm";
import { SUMMARY_SYSTEM, LEAD_REPORT_SYSTEM } from "./prompts";
import { retrieve, formatRetrievedContext, retrieveCrossProject } from "./retrieval";
import { embedText, serializeVector } from "./embedding";
import { buildToolCatalog, renderToolCatalog, resolveToolCalls } from "./mcp";
import type { AgentRole, AgentDocument, PipelineCallbacks, PipelineContext } from "@/lib/models/types";
import { STAGE_ORDER, ROLE_SYSTEM } from "./constants";
import { buildUserContent } from "./build-context";
import { streamAgent } from "./stream-agent";
import { runEngineerParallel } from "./run-parallel";
import { extractCode, validateCode } from "./extract-code";

// Re-exports for backward compatibility (merge.ts imports from pipeline)
export { extractCode, validateCode };

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

// Persist one stage's output to Supabase
async function persistStage(
  stage: AgentRole,
  output: string,
  summary: string,
  ctx: PipelineContext,
  metrics?: { duration_ms: number; input_tokens: number; output_tokens: number }
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
      ...(metrics || {}),
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
    const crossRetrieved = await retrieveCrossProject(
      ctx.userMessage, ctx.userId, ctx.projectId, 2
    );
    // Merge: current project first, then cross-project
    const allRetrieved = [
      ...retrieved.map(r => ({ ...r, source: "current" as const })),
      ...crossRetrieved,
    ];
    cbs.onRetrieve(allRetrieved);
    retrievedContext = formatRetrievedContext(allRetrieved);
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
      } catch (e) {
        console.warn("runEngineerParallel threw, falling back to serial:", e);
        cbs.onParallelEnd();
      }

      let content: string;
      let engMetrics: { duration_ms: number; input_tokens: number; output_tokens: number } | undefined;
      if (mergedCode) {
        content = `> 已通过组件级并行生成并合并代码。\n\n\`\`\`jsx\n${mergedCode}\n\`\`\``;
        cbs.onChunk(role, content);
      } else {
        // Fallback to serial full-app Engineer
        const result = await streamAgent(role, ROLE_SYSTEM[role], userContent, cbs);
        content = result.content;
        engMetrics = { duration_ms: result.duration_ms, input_tokens: result.input_tokens, output_tokens: result.output_tokens };
      }

      outputs[role] = content;
      const summary = await summarizeLLM(content, SUMMARY_SYSTEM);
      summaries[role] = summary;
      console.log("persistStage metrics for", role, ":", engMetrics || "undefined");
      const doc = await persistStage(role, content, summary, ctx, engMetrics);
      cbs.onStagePersist(role, doc);
      cbs.onStageComplete(role, content, summary);

      const code = extractCode(content);
      if (code) {
        const validation = validateCode(code);
        if (!validation.ok) {
          console.warn("Code validation issues:", validation.issues);
        }
        cbs.onCode(code);
      } else {
        console.log("runPipeline: extractCode failed, engineer output first 300 chars:", content.substring(0, 300));
        cbs.onError(role, "未能从工程师输出中提取到代码块");
      }
    } else {
      // Use report system prompt for team_lead when in report mode
      let systemPrompt = ROLE_SYSTEM[role];
      if (role === "team_lead" && ctx.round > 0 &&
          userContent.includes("## 各专家本轮的输出摘要")) {
        systemPrompt = LEAD_REPORT_SYSTEM;
      }
      const { content, duration_ms, input_tokens, output_tokens } =
        await streamAgent(role, systemPrompt, userContent, cbs);
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

      console.log("persistStage metrics for", role, ":", { duration_ms, input_tokens, output_tokens });
      const doc = await persistStage(role, content, summary, ctx,
        { duration_ms, input_tokens, output_tokens });
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
