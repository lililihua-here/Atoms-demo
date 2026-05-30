// app/workspace/[projectId]/page.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams } from "next/navigation";
import { PipelineProgress } from "@/components/pipeline/PipelineProgress";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import McpSettings from "@/components/McpSettings";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Message, StageState, ParallelTaskState } from "@/lib/models/types";

function WorkspaceContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<StageState[]>([
    { stage: "pm", status: "pending" },
    { stage: "architect", status: "pending" },
    { stage: "engineer", status: "pending" },
  ]);
  const [code, setCode] = useState<string>("");
  const [parallelTasks, setParallelTasks] = useState<ParallelTaskState[]>([]);
  const [retrieved, setRetrieved] = useState<any[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  // Load project info + history on mount
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) { router.replace("/projects"); return; }
        const data = await res.json();
        setProjectName(data.name || "");
        setCode(data.generated_code || "");

        // Rebuild messages from documents
        const docs = data.documents || [];
        const msgs: Message[] = [];
        for (const doc of docs) {
          msgs.push({
            id: String(doc.id),
            role: doc.agent_role as any,
            content: doc.content || "",
            summary: doc.summary,
            timestamp: doc.created_at,
          });
        }
        if (msgs.length > 0) setMessages(msgs);
      } catch {}
      setLoading(false);
    })();
  }, [projectId]);

  const handleSend = async (message: string) => {
    if (busy) return;
    setBusy(true);
    setParallelTasks([]);
    setRetrieved([]);
    setStages((s) => s.map((st) => ({ ...st, status: "pending" as const })));

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Placeholder messages for each agent stage
    const agentMsgIds: Record<string, string> = {
      pm: `agent-${Date.now()}-pm`,
      architect: `agent-${Date.now()}-architect`,
      engineer: `agent-${Date.now()}-engineer`,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Track streaming content per agent
      const agentContent: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const eventType = line.startsWith("event: ")
            ? lines[lines.indexOf(line) - 1]?.replace("event: ", "")
            : "";

          const dataStr = line.replace(/^(event: .*\n)?data: /, "");
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            const event = eventType || data.event || "";

            switch (event || data.event) {
              case "stage_start":
                setStages((s) =>
                  s.map((st) =>
                    st.stage === data.agent ? { ...st, status: "running" as const } : st
                  )
                );
                break;

              case "agent_output": {
                const agent = data.agent;
                agentContent[agent] = data.chunk;
                const agentId = agentMsgIds[agent];
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === agentId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === agentId ? { ...m, content: data.chunk, streaming: true } : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: agentId,
                      role: agent,
                      content: data.chunk,
                      timestamp: new Date().toISOString(),
                      streaming: true,
                    },
                  ];
                });
                break;
              }

              case "stage_done":
                setStages((s) =>
                  s.map((st) =>
                    st.stage === data.agent
                      ? { ...st, status: "completed" as const, summary: data.summary }
                      : st
                  )
                );
                // Finalize agent message
                {
                  const agentId = agentMsgIds[data.agent];
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentId
                        ? { ...m, content: agentContent[data.agent] || m.content, summary: data.summary, streaming: false }
                        : m
                    )
                  );
                }
                break;

              case "code_generated":
                setCode(data.code);
                break;

              case "agent_error":
                setStages((s) =>
                  s.map((st) =>
                    st.stage === data.agent ? { ...st, status: "failed" as const } : st
                  )
                );
                break;

              case "retrieve":
                setRetrieved(data.docs || []);
                break;

              case "parallel_start":
                setParallelTasks(data.tasks || []);
                break;

              case "parallel_update":
                setParallelTasks((prev) =>
                  prev.map((t) =>
                    t.componentName === data.task.componentName
                      ? { ...t, status: data.task.status }
                      : t
                  )
                );
                break;

              case "parallel_end":
                // Keep tasks visible
                break;
            }
          } catch {}
        }
      }
    } catch {}

    setBusy(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-serif font-bold text-lg truncate max-w-[200px]">
            {projectName || "未命名项目"}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMemoryOpen(!memoryOpen)}
            className={memoryOpen ? "bg-muted" : ""}
          >
            <Brain className="h-4 w-4 mr-1" />
            记忆
          </Button>
          <McpSettings />
        </div>
      </header>

      {/* Pipeline Progress */}
      <PipelineProgress stages={stages} parallelTasks={parallelTasks} />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Chat */}
        <div className={`flex flex-col border-r border-border ${memoryOpen ? "w-[40%]" : "flex-1"}`}>
          <ChatPanel messages={messages} busy={busy} onSend={handleSend} />
        </div>

        {/* Memory sidebar */}
        {memoryOpen && (
          <div className="w-[20%] border-r border-border min-w-[180px]">
            <MemoryPanel docs={retrieved} />
          </div>
        )}

        {/* Preview */}
        <div className={`${memoryOpen ? "w-[40%]" : "flex-1"}`}>
          <PreviewPanel code={code} />
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage({ params }: { params: { projectId: string } }) {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <WorkspaceContent projectId={params.projectId} />
    </Suspense>
  );
}
