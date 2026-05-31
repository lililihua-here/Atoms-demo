// lib/agent/build-context.ts
import { STAGE_ORDER, ROLE_LABELS } from "./constants";
import { MCP_TOOLS_NOTE } from "./prompts";
import type { AgentRole, AgentDocument, PipelineContext } from "@/lib/models/types";

// Build context for a single stage
export function buildUserContent(
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

  // Report mode: Team Lead summarizes previous agents' output
  // Uses latest doc per agent_role (robust to round fragmentation across API calls)
  if (stage === "team_lead" && ctx.round > 0) {
    const nonLeadDocs = allDocs
      .filter(d => d.agent_role !== "team_lead")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const latest: AgentDocument[] = [];
    for (const d of nonLeadDocs) {
      if (!seen.has(d.agent_role)) { seen.add(d.agent_role); latest.push(d); }
    }
    if (latest.length > 0) {
      const summaries = latest.map(d => `[${ROLE_LABELS[d.agent_role as AgentRole] ?? d.agent_role}] ${d.summary}`);
      parts.push(`## 各专家本轮的输出摘要\n${summaries.join("\n\n")}\n\n请向用户汇报本轮成果。`);
    }
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
