// components/preview/PreviewPanel.tsx
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Code2, Play } from "lucide-react";

interface PreviewPanelProps {
  code: string;
}

const EMPTY_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { display:flex; align-items:center; justify-content:center; height:100vh;
         font-family:system-ui,sans-serif; color:#999; background:#fafafa; }
  .card { text-align:center; padding:40px; }
  .card .icon { font-size:48px; margin-bottom:16px; opacity:0.3; }
  .card p { font-size:14px; line-height:1.6; }
</style></head>
<body>
<div class="card">
  <div class="icon">⚛</div>
  <p>还没有生成代码<br>输入需求后 AI 将为你生成应用</p>
</div>
</body></html>`;

function buildSrcDoc(code: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = { corePlugins: { preflight: true } };
  <\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
  <\/script>
</body>
</html>`;
}

export function PreviewPanel({ code }: PreviewPanelProps) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    console.log("[Preview] code state changed, length:", code?.length || 0);
  }, [code]);

  const srcDoc = useMemo(
    () => (code ? buildSrcDoc(code) : EMPTY_HTML),
    [code]
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border/20 px-3 py-1.5 flex items-center justify-between shrink-0">
          <TabsList className="rounded-none justify-start bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="preview" className="text-xs h-7 px-2 data-[state=active]:bg-muted">
              <Play className="h-3 w-3 mr-1" /> 预览
            </TabsTrigger>
            <TabsTrigger value="source" className="text-xs h-7 px-2 data-[state=active]:bg-muted">
              <Code2 className="h-3 w-3 mr-1" /> 源码
            </TabsTrigger>
          </TabsList>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setKey((k) => k + 1)}
            title="刷新预览"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <TabsContent value="preview" className="flex-1 m-0 min-h-0 bg-white">
          <iframe
            key={key}
            srcDoc={srcDoc}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="应用预览"
          />
        </TabsContent>
        <TabsContent value="source" className="flex-1 m-0 min-h-0 overflow-auto p-4 bg-[#f8f8f8]">
          <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {code || "暂无代码"}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
