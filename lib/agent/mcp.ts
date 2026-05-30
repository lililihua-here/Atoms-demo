// lib/agent/mcp.ts
// MCP (Model Context Protocol) client layer.
// Persists server configs in agent_documents (agent_role='mcp_server').
// Discovers tools and invokes them via backend API proxy routes.

import { createServerSupabase } from "@/lib/supabase/server";

export type McpConnectionType = "builtin" | "remote";

export interface McpServerConfig {
  id?: number;
  name: string;
  connectionType: McpConnectionType;
  url: string;
  authToken: string;
  description: string;
  enabled: boolean;
}

export interface McpToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  params: McpToolParam[];
  serverId: number | string;
  serverName: string;
}

const MCP_ROLE = "mcp_server";

// ----------------------------- CRUD ---------------------------------------- //

export async function listServers(): Promise<McpServerConfig[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("agent_documents")
    .select("*")
    .eq("agent_role", MCP_ROLE)
    .order("created_at", { ascending: false });

  if (!data) return [];
  return data.map((d: any) => {
    let cfg: any = {};
    try { cfg = JSON.parse(d.content || "{}"); } catch { cfg = {}; }
    return {
      id: d.id,
      name: cfg.name || "未命名服务器",
      connectionType: cfg.connectionType === "remote" ? "remote" : "builtin",
      url: cfg.url || "",
      authToken: cfg.authToken || "",
      description: cfg.description || "",
      enabled: cfg.enabled !== false,
    };
  });
}

export async function createServer(
  cfg: Omit<McpServerConfig, "id">
): Promise<McpServerConfig | null> {
  const supabase = createServerSupabase();
  const content = JSON.stringify({
    name: cfg.name,
    connectionType: cfg.connectionType,
    url: cfg.url,
    authToken: cfg.authToken,
    description: cfg.description,
    enabled: cfg.enabled,
  });
  const { data } = await supabase
    .from("agent_documents")
    .insert({
      project_id: "00000000-0000-0000-0000-000000000000",
      agent_role: MCP_ROLE,
      content,
      summary: cfg.name,
      round: 0,
    })
    .select()
    .single();

  if (!data) return null;
  return { ...cfg, id: data.id };
}

export async function updateServer(
  id: number,
  cfg: Omit<McpServerConfig, "id">
): Promise<boolean> {
  const supabase = createServerSupabase();
  const content = JSON.stringify({
    name: cfg.name,
    connectionType: cfg.connectionType,
    url: cfg.url,
    authToken: cfg.authToken,
    description: cfg.description,
    enabled: cfg.enabled,
  });
  const { error } = await supabase
    .from("agent_documents")
    .update({ content, summary: cfg.name })
    .eq("id", id);
  return !error;
}

export async function deleteServer(id: number): Promise<boolean> {
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("agent_documents")
    .delete()
    .eq("id", id);
  return !error;
}

// ------------------------- Discovery & invocation -------------------------- //

export async function discoverTools(cfg: McpServerConfig): Promise<McpTool[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/mcp/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connection_type: cfg.connectionType,
      url: cfg.url || null,
      auth_token: cfg.authToken || null,
    }),
  });
  if (!res.ok) throw new Error(`Discovery failed: ${res.statusText}`);
  const data = await res.json();
  const tools: any[] = data.tools || [];
  return tools.map((t: any) => ({
    name: t.name,
    description: t.description || "",
    params: t.params || [],
    serverId: cfg.id || "",
    serverName: cfg.name,
  }));
}

export interface McpCallResult {
  ok: boolean;
  result: string;
  error: string;
}

export async function callTool(
  cfg: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<McpCallResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/mcp/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connection_type: cfg.connectionType,
        url: cfg.url || null,
        auth_token: cfg.authToken || null,
        tool_name: toolName,
        arguments: args || {},
      }),
    });
    const data = await res.json();
    return {
      ok: data.error ? false : true,
      result: data.result || "",
      error: data.error || "",
    };
  } catch (e: any) {
    return { ok: false, result: "", error: e.message || "工具调用失败" };
  }
}

// ------------------------- Tool catalog for agents ------------------------- //

export async function buildToolCatalog(): Promise<{
  servers: McpServerConfig[];
  tools: McpTool[];
}> {
  const servers = (await listServers()).filter((s) => s.enabled);
  const tools: McpTool[] = [];
  await Promise.all(
    servers.map(async (s) => {
      try {
        const t = await discoverTools(s);
        tools.push(...t);
      } catch {
        // Skip unreachable servers
      }
    })
  );
  return { servers, tools };
}

// Render the catalog as a compact text block for agent prompts
export function renderToolCatalog(toolsOrCatalog: McpTool[] | Map<string, McpTool[]>): string {
  let tools: McpTool[];
  if (Array.isArray(toolsOrCatalog)) {
    tools = toolsOrCatalog;
  } else {
    tools = [];
    toolsOrCatalog.forEach((t) => { tools.push(...t); });
  }
  if (!tools.length) return "";
  const lines = tools.map((t) => {
    const paramStr = t.params
      .map((p) => `${p.name}${p.required ? "" : "?"}:${p.type}`)
      .join(", ");
    return `- ${t.serverName}/${t.name}(${paramStr}) — ${t.description}`;
  });
  return ["## 可用的 MCP 外部工具", ...lines].join("\n");
}

// Resolve tool_call blocks from agent output
export async function resolveToolCalls(
  agentOutput: string,
  servers?: McpServerConfig[]
): Promise<string | null> {
  const match = agentOutput.match(/```tool_call\s*\n?([\s\S]*?)```/i);
  if (!match) return null;

  const svrs = servers || (await listServers()).filter((s) => s.enabled);

  try {
    const req = JSON.parse(match[1].trim());
    const server =
      svrs.find((s) => s.name === req.server) ||
      svrs.find((s) => s.enabled);
    if (!server || !req.tool) return `\n\n> ⚠️ MCP 服务器 "${req.server}" 未找到或已禁用`;

    const r = await callTool(server, req.tool, req.arguments || {});
    if (r.ok) {
      return `\n\n> 🔧 工具调用结果 (${server.name}/${req.tool}):\n> \`\`\`\n> ${r.result}\n> \`\`\``;
    }
    return `\n\n> ❌ 工具调用失败: ${r.error}`;
  } catch (e: any) {
    return `\n\n> ❌ 工具调用解析失败: ${e.message}`;
  }
}
