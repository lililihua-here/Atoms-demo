// app/workspace/[projectId]/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
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
  const [resume, setResume] = useState<{ requirement: string; round: number; nextRole: string } | null>(null);

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

        // Rebuild messages from documents, ordered by created_at
        const docs: any[] = (data.documents || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const msgs: Message[] = [];
        const roleOrder = ["pm", "architect", "engineer"];

        for (const doc of docs) {
          // Insert user message before the first PM doc of each round
          if (doc.agent_role === "pm" && doc.tags && doc.tags.length > 0) {
            msgs.push({
              id: `u-${doc.round}`,
              role: "user",
              content: Array.isArray(doc.tags) ? doc.tags[0] : String(doc.tags),
              timestamp: doc.created_at,
            });
          }
          msgs.push({
            id: `${doc.agent_role}-${doc.round}`,
            role: doc.agent_role as any,
            content: doc.content || "",
            summary: doc.summary,
            timestamp: doc.created_at,
          });
        }

        if (msgs.length > 0) setMessages(msgs);

        // Detect breakpoint resume: PM done but missing later roles in latest round
        const byRound = new Map<number, any[]>();
        for (const doc of docs) {
          const list = byRound.get(doc.round) || [];
          list.push(doc);
          byRound.set(doc.round, list);
        }
        if (byRound.size > 0) {
          const maxRound = Math.max(...byRound.keys());
          const roundDocs = byRound.get(maxRound) || [];
          const rolesInRound = new Set(roundDocs.map((d) => d.agent_role));
          const hasPm = rolesInRound.has("pm");
          const missingLater = !rolesInRound.has("architect") || !rolesInRound.has("engineer");
          if (hasPm && missingLater) {
            const pmDoc = roundDocs.find((d) => d.agent_role === "pm");
            const nextRole = roleOrder.find((r) => !rolesInRound.has(r));
            setResume({
              requirement: (pmDoc?.tags && pmDoc.tags[0]) || "继续生成",
              round: maxRound,
              nextRole: nextRole || "architect",
            });
            // Mark completed stages
            setStages((s) =>
              s.map((st) =>
                rolesInRound.has(st.stage)
                  ? { ...st, status: "completed" as const }
                  : st
              )
            );
          }
        }
      } catch (e) { console.error("Load project failed:", e); }
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

      if (!res.ok) {
        const errText = await res.text();
        console.error("Chat API error:", res.status, errText);
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "system",
          content: `请求失败 (${res.status}): ${errText || "未知错误"}`,
          timestamp: new Date().toISOString(),
        }]);
        setBusy(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      // Track streaming content per agent
      const agentContent: Record<string, string> = {};

      // Process a single SSE event by dispatching to the switch handler
      const dispatchEvent = (eventType: string, data: any) => {
        switch (eventType || data.event) {
          case "connected":
            console.log("[Pipeline] Stream connected, round:", data.round);
            break;

          case "stage_start":
            setStages((s) =>
              s.map((st) =>
                st.stage === data.agent ? { ...st, status: "running" as const } : st
              )
            );
            break;

          case "agent_output": {
            const agent = data.agent;
            // Server sends accumulated full text, just store it
            agentContent[agent] = data.chunk || "";
            const fullText = agentContent[agent];
            const agentId = agentMsgIds[agent];
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === agentId);
              if (existing) {
                return prev.map((m) =>
                  m.id === agentId ? { ...m, content: fullText, streaming: true } : m
                );
              }
              return [
                ...prev,
                {
                  id: agentId,
                  role: agent as any,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  streaming: true,
                },
              ];
            });
            break;
          }

          case "code_generated":
            console.log("[Pipeline] Code received, length:", data.code?.length || 0);
            setCode(data.code);
            break;

          case "stage_done":
            setStages((s) =>
              s.map((st) =>
                st.stage === data.agent
                  ? { ...st, status: "completed" as const, summary: data.summary }
                  : st
              )
            );
            {
              const agentId = agentMsgIds[data.agent];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentId
                    ? { ...m, content: agentContent[data.agent] || m.content, summary: data.summary, streaming: false }
                    : m
                )
              );
              // Fallback: if engineer finished, try extracting code from output
              if (data.agent === "engineer") {
                const engContent = agentContent[data.agent] || "";
                if (engContent) {
                  let extracted = "";
                  // Try fenced blocks
                  let fenced = engContent.match(/```(?:jsx|js|javascript|tsx|react)\s*\n([\s\S]*?)```/i);
                  if (!fenced) fenced = engContent.match(/```\s*\n([\s\S]*?)```/);
                  if (fenced && fenced[1] && fenced[1].trim().length > 20) {
                    extracted = fenced[1].trim();
                  } else {
                    // Try raw function detection
                    const appIdx = engContent.search(/(?:^|\n)\s*(?:function\s+App\s*\(|const\s+App\s*=)/m);
                    if (appIdx >= 0) extracted = engContent.substring(appIdx).trim();
                  }
                  if (extracted) {
                    console.log("[Pipeline] Fallback extracted code, length:", extracted.length);
                    setCode(extracted);
                  } else {
                    console.warn("[Pipeline] No code found in engineer output");
                  }
                }
              }
            }
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
            break;

          case "pipeline_done":
            if (data.status === "failed") {
              setMessages((prev) => [...prev, {
                id: `error-${Date.now()}`,
                role: "system",
                content: `流水线执行失败: ${data.error || "未知错误"}`,
                timestamp: new Date().toISOString(),
              }]);
            } else if (data.code) {
              console.log("[Pipeline] code from pipeline_done, length:", data.code.length);
              setCode(data.code);
            }
            setBusy(false);
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE state machine: extract event + data pairs
        while (buffer.includes("\n")) {
          const newlineIdx = buffer.indexOf("\n");
          const line = buffer.substring(0, newlineIdx).trimEnd();
          buffer = buffer.substring(newlineIdx + 1);

          if (line === "") {
            // Empty line = end of event, dispatch
            continue;
          }

          if (line.startsWith("event: ")) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") continue;
            console.log("[SSE]", currentEvent || "(no-event)", dataStr.substring(0, 80));
            try {
              const data = JSON.parse(dataStr);
              dispatchEvent(currentEvent, data);
            } catch { console.warn("[SSE] JSON parse failed:", dataStr.substring(0, 80)); }
            currentEvent = "";
          }
        }
      }
    } catch (e) { console.error("Chat stream failed:", e); }

    setBusy(false);
  };

  const handleResume = () => {
    if (!resume || busy) return;
    const req = resume.requirement;
    setResume(null);
    handleSend(req);
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

      {/* Resume banner */}
      {resume && !busy && (
        <div className="border-b-2 border-border bg-muted shrink-0">
          <div className="px-4 py-2 flex items-center justify-between gap-4">
            <span className="text-sm truncate">
              上次生成中断，可从「{resume.nextRole === "architect" ? "架构师" : "工程师"}」阶段继续
            </span>
            <Button size="sm" onClick={() => handleResume()}>
              继续生成
            </Button>
          </div>
        </div>
      )}

      {/* Main content area — responsive grid */}
      <div className="flex-1 grid min-h-0"
        style={{
          gridTemplateColumns: memoryOpen
            ? "1fr 240px 1fr"
            : "1fr 1fr",
        }}
      >
        {/* Chat */}
        <div className="flex flex-col border-r border-border/20 min-w-0 h-full overflow-hidden">
          <ChatPanel messages={messages} busy={busy} onSend={handleSend} />
        </div>

        {/* Memory sidebar */}
        {memoryOpen && (
          <div className="border-r border-border/20 min-w-0 h-full overflow-hidden hidden md:block">
            <MemoryPanel docs={retrieved} />
          </div>
        )}

        {/* Preview */}
        <div className="min-w-0 h-full overflow-hidden hidden md:block">
          <PreviewPanel code={code} />
        </div>
        {memoryOpen && (
          <div className="md:hidden border-t border-border/20">
            <MemoryPanel docs={retrieved} />
          </div>
        )}
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
