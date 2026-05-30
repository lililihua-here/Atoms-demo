// components/McpSettings.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, Plus, Trash2, RefreshCw, Play, Wifi, WifiOff } from "lucide-react";

interface McpServerConfig {
  id?: number;
  name: string;
  connectionType: "builtin" | "remote";
  url: string;
  authToken: string;
  description: string;
  enabled: boolean;
}

interface McpTool {
  name: string;
  description: string;
  params: { name: string; type: string; description: string; required: boolean }[];
  serverId: number | string;
  serverName: string;
}

const MCP_ROLE = "mcp_server";
const SENTINEL_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

export default function McpSettings() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const loadServers = useCallback(async () => {
    const { data } = await supabase
      .from("agent_documents")
      .select("*")
      .eq("agent_role", MCP_ROLE)
      .order("created_at", { ascending: false });
    if (!data) return;
    setServers(
      data.map((d: any) => {
        let cfg: any = {};
        try { cfg = JSON.parse(d.content || "{}"); } catch { cfg = {}; }
        return {
          id: d.id,
          name: cfg.name || "未命名",
          connectionType: cfg.connectionType === "remote" ? "remote" : "builtin",
          url: cfg.url || "",
          authToken: cfg.authToken || "",
          description: cfg.description || "",
          enabled: cfg.enabled !== false,
        };
      })
    );
  }, [supabase]);

  useEffect(() => {
    if (open) loadServers();
  }, [open, loadServers]);

  async function saveServer(cfg: McpServerConfig) {
    const content = JSON.stringify({
      name: cfg.name,
      connectionType: cfg.connectionType,
      url: cfg.url,
      authToken: cfg.authToken,
      description: cfg.description,
      enabled: cfg.enabled,
    });
    if (cfg.id) {
      await supabase.from("agent_documents").update({ content, summary: cfg.name }).eq("id", cfg.id);
    } else {
      await supabase.from("agent_documents").insert({
        project_id: SENTINEL_PROJECT_ID,
        agent_role: MCP_ROLE,
        content,
        summary: cfg.name,
        round: 0,
      });
    }
    setEditing(null);
    loadServers();
  }

  async function deleteServer(id: number) {
    await supabase.from("agent_documents").delete().eq("id", id);
    loadServers();
  }

  async function toggleServer(server: McpServerConfig) {
    const updated = { ...server, enabled: !server.enabled };
    const content = JSON.stringify({
      name: updated.name,
      connectionType: updated.connectionType,
      url: updated.url,
      authToken: updated.authToken,
      description: updated.description,
      enabled: updated.enabled,
    });
    await supabase.from("agent_documents").update({ content }).eq("id", server.id!);
    loadServers();
  }

  async function discoverTools(server: McpServerConfig) {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_type: server.connectionType,
          url: server.url || null,
          auth_token: server.authToken || null,
        }),
      });
      const data = await res.json();
      setTools((prev) => ({ ...prev, [server.name]: data.tools || [] }));
    } catch {}
    setLoading(false);
  }

  async function testTool(server: McpServerConfig, tool: McpTool, args: Record<string, string>) {
    const res = await fetch("/api/mcp/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connection_type: server.connectionType,
        url: server.url || null,
        auth_token: server.authToken || null,
        tool_name: tool.name,
        arguments: args,
      }),
    });
    const data = await res.json();
    alert(data.error ? `Error: ${data.error}` : `Result: ${JSON.stringify(data.result || data)}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>MCP 服务器管理</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh]">
          <div className="space-y-3 p-1">
            {servers.map((server) => (
              <Card key={server.id} className={server.enabled ? "" : "opacity-60"}>
                <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{server.name}</CardTitle>
                    <Badge variant={server.connectionType === "builtin" ? "secondary" : "outline"}>
                      {server.connectionType}
                    </Badge>
                    {server.enabled ? (
                      <Wifi className="h-3 w-3 text-green-500" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleServer(server)}>
                          {server.enabled ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{server.enabled ? "禁用" : "启用"}</TooltipContent>
                    </Tooltip>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => discoverTools(server)} disabled={loading}>
                      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(server)}>
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => server.id && deleteServer(server.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                {tools[server.name]?.length > 0 && (
                  <CardContent className="p-3 pt-2">
                    <div className="text-xs font-medium mb-1">可用工具:</div>
                    {tools[server.name].map((tool) => (
                      <ToolTest key={tool.name} tool={tool} server={server} onTest={testTool} />
                    ))}
                  </CardContent>
                )}
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setEditing({ name: "", connectionType: "builtin", url: "", authToken: "", description: "", enabled: true })}>
              <Plus className="h-4 w-4 mr-1" /> 添加服务器
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>

      {editing && (
        <ServerEditDialog
          server={editing}
          onSave={saveServer}
          onClose={() => setEditing(null)}
        />
      )}
    </Dialog>
  );
}

function ToolTest({
  tool,
  server,
  onTest,
}: {
  tool: McpTool;
  server: McpServerConfig;
  onTest: (server: McpServerConfig, tool: McpTool, args: Record<string, string>) => void;
}) {
  const [args, setArgs] = useState<Record<string, string>>({});
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <span className="font-mono font-medium">{tool.name}</span>
      <span className="text-gray-500">{tool.description}</span>
      {tool.params.map((p) => (
        <Input
          key={p.name}
          className="h-6 w-24 text-xs"
          placeholder={p.name}
          value={args[p.name] || ""}
          onChange={(e) => setArgs((a) => ({ ...a, [p.name]: e.target.value }))}
        />
      ))}
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onTest(server, tool, args)}>
        <Play className="h-3 w-3" />
      </Button>
    </div>
  );
}

function ServerEditDialog({
  server,
  onSave,
  onClose,
}: {
  server: McpServerConfig;
  onSave: (cfg: McpServerConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(server);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form.id ? "编辑服务器" : "添加服务器"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">名称</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">类型</label>
            <select
              className="w-full border rounded p-2 text-sm"
              value={form.connectionType}
              onChange={(e) => setForm({ ...form, connectionType: e.target.value as "builtin" | "remote" })}
            >
              <option value="builtin">内置</option>
              <option value="remote">远程 HTTP</option>
            </select>
          </div>
          {form.connectionType === "remote" && (
            <>
              <div>
                <label className="text-xs font-medium">URL</label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Auth Token (可选)</label>
                <Input value={form.authToken} onChange={(e) => setForm({ ...form, authToken: e.target.value })} />
              </div>
            </>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={() => onSave(form)}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
