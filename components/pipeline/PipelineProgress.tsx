// components/pipeline/PipelineProgress.tsx
"use client";

import { Sparkles, PenTool, Code2, Check, Loader2, X, ChevronRight } from "lucide-react";
import type { StageState, ParallelTaskState } from "@/lib/models/types";

const STAGE_ICONS: Record<string, React.ReactNode> = {
  pm: <Sparkles className="h-3.5 w-3.5" />,
  architect: <PenTool className="h-3.5 w-3.5" />,
  engineer: <Code2 className="h-3.5 w-3.5" />,
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

const statusClass = (status: string): string => {
  switch (status) {
    case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "running":   return "bg-blue-50 text-blue-700 border-blue-200";
    case "failed":    return "bg-red-50 text-red-700 border-red-200";
    default:          return "bg-muted text-muted-foreground";
  }
};

const taskStatusClass = (status: string): string => {
  switch (status) {
    case "success":     return "bg-emerald-50 text-emerald-700";
    case "running":     return "bg-blue-50 text-blue-700";
    case "failed":      return "bg-red-50 text-red-700";
    case "placeholder": return "bg-amber-50 text-amber-700";
    default:            return "bg-muted text-muted-foreground";
  }
};

export function PipelineProgress({ stages, parallelTasks }: PipelineProgressProps) {
  const anyActive = stages.some((s) => s.status !== "pending");

  if (!anyActive && parallelTasks.length === 0) {
    return (
      <div className="px-4 py-2.5 border-b border-border/20">
        <p className="text-xs text-muted-foreground text-center">
          等待输入需求以启动 AI 协作流水线
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-border/20 px-4 py-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 border text-xs font-medium transition-colors duration-300 ${
              statusClass(stage.status)
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
              <ChevronRight className={`h-3 w-3 transition-colors duration-300 ${
                stage.status === "completed" ? "text-emerald-400" : "text-muted-foreground/30"
              }`} />
            )}
          </div>
        ))}
      </div>

      {parallelTasks.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
            并行组件生成
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parallelTasks.map((t) => (
              <span
                key={t.componentName}
                className={`px-2 py-0.5 text-xs font-medium transition-colors duration-300 ${
                  taskStatusClass(t.status)
                }`}
              >
                {t.status === "running" && <Loader2 className="h-3 w-3 inline animate-spin mr-1" />}
                {t.componentName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
