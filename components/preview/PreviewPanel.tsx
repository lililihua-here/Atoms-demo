// components/preview/PreviewPanel.tsx
"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Code2, Play } from "lucide-react";

interface PreviewPanelProps {
  code: string;
}

export function PreviewPanel({ code }: PreviewPanelProps) {
  const [key, setKey] = useState(0);

  const srcDoc = code
    ? buildSrcDoc(code)
    : '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#888;"><p>还没有生成代码。输入需求后 AI 将为你生成应用。</p></body></html>';

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Play className="h-3 w-3" />
          <span>预览</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setKey((k) => k + 1)}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <TabsList className="px-3 pt-1 border-b border-border rounded-none justify-start bg-transparent">
          <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-muted">
            <Play className="h-3 w-3 mr-1" /> 预览
          </TabsTrigger>
          <TabsTrigger value="source" className="text-xs data-[state=active]:bg-muted">
            <Code2 className="h-3 w-3 mr-1" /> 源码
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="flex-1 m-0">
          <iframe
            key={key}
            srcDoc={srcDoc}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="应用预览"
          />
        </TabsContent>
        <TabsContent value="source" className="flex-1 m-0 overflow-auto p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap">{code || "暂无代码"}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildSrcDoc(code: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
  </script>
</body>
</html>`;
}
