// app/api/mcp/call/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { connection_type, url, auth_token, tool_name, arguments: args } = await req.json();

    if (connection_type === "builtin") {
      switch (tool_name) {
        case "echo":
          return NextResponse.json({ result: String(args?.message ?? "no input") });
        case "now":
          return NextResponse.json({ result: new Date().toISOString() });
        case "calc": {
          const expr = String(args?.expression ?? "0");
          if (!/^[\d\s+\-*/().]+$/.test(expr)) {
            return NextResponse.json({ error: "表达式包含不允许的字符" }, { status: 400 });
          }
          try {
            const result = Function(`"use strict"; return (${expr})`)();
            return NextResponse.json({ result: String(result) });
          } catch {
            return NextResponse.json({ error: "表达式计算失败" }, { status: 400 });
          }
        }
        default:
          return NextResponse.json({ error: `未知内置工具: ${tool_name}` }, { status: 404 });
      }
    }

    // Remote HTTP MCP — JSON-RPC tools/call
    if (url) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth_token ? { Authorization: `Bearer ${auth_token}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: tool_name, arguments: args || {} },
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (data.error) {
        return NextResponse.json(
          { error: data.error.message || "Unknown error" },
          { status: 500 }
        );
      }
      return NextResponse.json(data.result || data);
    }

    return NextResponse.json({ error: "No URL provided for remote server" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
