// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runPipeline, loadHistory, classifyIntent } from "@/lib/agent/pipeline";
import type { PipelineCallbacks, AgentRole, ParallelTaskState, AgentDocument } from "@/lib/models/types";

function sse(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { projectId, message } = await req.json();
  if (!projectId || !message) {
    return new Response(JSON.stringify({ error: "Missing projectId or message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify project ownership + determine round
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const shared = project.shared_json || {};
  const round = shared.round ? shared.round + 1 : 1;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: any) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      const cbs: PipelineCallbacks = {
        onStageStart: (stage) => enqueue("stage_start", { agent: stage }),
        onChunk: (stage, text) => enqueue("agent_output", { agent: stage, chunk: text }),
        onStageComplete: (stage, output, summary) =>
          enqueue("stage_done", { agent: stage, summary }),
        onStagePersist: (stage, doc) => {
          enqueue("stage_persisted", { agent: stage, doc });
        },
        onCode: (code) => enqueue("code_generated", { code }),
        onError: (stage, error) => enqueue("agent_error", { agent: stage, error }),
        onRetrieve: (docs) => enqueue("retrieve", { docs }),
        onParallelStart: (tasks) => enqueue("parallel_start", { tasks }),
        onParallelUpdate: (task) => enqueue("parallel_update", { task }),
        onParallelEnd: () => enqueue("parallel_end", {}),
      };

      try {
        // Send immediate ping so frontend knows stream is alive
        enqueue("connected", { projectId, round });
        console.log("Pipeline starting:", { projectId, round, message: message.substring(0, 50) });
        // Classify intent and get previous code for iteration
        const roles = classifyIntent(message);
        let previousCode: string | undefined;
        if (project.generated_code) {
          previousCode = project.generated_code;
        }

        const result = await runPipeline(
          { projectId, userId: user.id, userMessage: message, round, previousCode },
          cbs,
          roles
        );
        console.log("Pipeline done, code length:", result.code?.length || 0);

        // Update project shared_json for next round
        const newShared = {
          ...shared,
          round,
          pmSummary: result.pmSummary || shared.pmSummary,
          architectSummary: result.architectSummary || shared.architectSummary,
          engineerSummary: result.engineerSummary || shared.engineerSummary,
        };
        await supabase
          .from("projects")
          .update({ shared_json: newShared, updated_at: new Date().toISOString() })
          .eq("id", projectId);

        // Update generated_code if available
        if (result.code) {
          await supabase
            .from("projects")
            .update({ generated_code: result.code, updated_at: new Date().toISOString() })
            .eq("id", projectId);
        }

        enqueue("pipeline_done", { status: "completed", code: result.code });
      } catch (e: any) {
        enqueue("pipeline_done", { status: "failed", error: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
