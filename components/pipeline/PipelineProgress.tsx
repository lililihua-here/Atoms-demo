// components/pipeline/PipelineProgress.tsx
"use client";

import { Sparkles, PenTool, Code2, Check, Loader2, X } from "lucide-react";
import type { StageState, ParallelTaskState } from "@/lib/models/types";

const STAGE_ICONS: Record<string, React.ReactNode> = {
  pm: <Sparkles className="h-4 w-4" />,
  architect: <PenTool className="h-4 w-4" />,
  engineer: <Code2 className="h-4 w-4" />,
};

const STAGE_LABELS: Record<string, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
};

interface PipelineProgressProps {
  stages: StageState[];
  parallelTasks: ParallelTaskState[];
}

export function PipelineProgress({ stages, parallelTasks }: PipelineProgressProps) {
  const anyActive = stages.some((s) => s.status !== "pending");

  if (!anyActive && parallelTasks.length === 0) {
    return (
      <div className="px-4 py-2 border-b border-border">
        <p className="text-xs text-muted-foreground text-center">等待输入需求以启动 AI 协作流水线</p>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-2">
      <div className="flex items-center gap-2">
        {stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              stage.status === "completed"
                ? "bg-green-50 text-green-700"
                : stage.status === "running"
                ? "bg-blue-50 text-blue-700"
                : stage.status === "failed"
                ? "bg-red-50 text-red-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {stage.status === "completed" ? (
                <Check className="h-3 w-3" />
              ) : stage.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : stage.status === "failed" ? (
                <X className="h-3 w-3" />
              ) : (
                STAGE_ICONS[stage.stage]
              )}
              <span>{STAGE_LABELS[stage.stage]}</span>
            </div>
            {i < stages.length - 1 && (
              <div className={`h-px w-4 ${
                stage.status === "completed" ? "bg-green-300" : "bg-gray-200"
              }`} />
            )}
          </div>
        ))}
      </div>

      {parallelTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {parallelTasks.map((t) => (
            <span
              key={t.componentName}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                t.status === "success"
                  ? "bg-green-100 text-green-700"
                  : t.status === "running"
                  ? "bg-blue-100 text-blue-700"
                  : t.status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {t.status === "running" && <Loader2 className="h-2.5 w-2.5 inline animate-spin mr-1" />}
              {t.componentName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
