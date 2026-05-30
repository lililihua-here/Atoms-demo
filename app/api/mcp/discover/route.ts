// app/api/mcp/discover/route.ts
import { NextRequest, NextResponse } from "next/server";

// Builtin demo tools
const BUILTIN_TOOLS = [
  {
    name: "echo",
    description: "返回输入的参数",
    params: [{ name: "message", type: "string", description: "要回显的消息", required: true }],
  },
  {
    name: "now",
    description: "返回当前 ISO 8601 时间戳",
    params: [],
  },
  {
    name: "calc",
    description: "安全计算数学表达式（仅支持 +-*/ 和括号）",
    params: [{ name: "expression", type: "string", description: "数学表达式，如 (2+3)*4", required: true }],
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.connection_type === "builtin") {
      return NextResponse.json({ tools: BUILTIN_TOOLS });
    }

    // Remote HTTP MCP — JSON-RPC tools/list
    if (body.url) {
      const res = await fetch(body.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(body.auth_token ? { Authorization: `Bearer ${body.auth_token}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      const rawTools: any[] = data.result?.tools || [];
      const tools = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description || "",
        params: (t.inputSchema?.properties
          ? Object.entries(t.inputSchema.properties).map(([k, v]: [string, any]) => ({
              name: k,
              type: v.type || "any",
              description: v.description || "",
              required: t.inputSchema?.required?.includes(k) || false,
            }))
          : []),
      }));
      return NextResponse.json({ tools });
    }

    return NextResponse.json({ tools: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
