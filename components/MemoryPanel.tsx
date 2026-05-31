// components/MemoryPanel.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { useRouter } from "next/navigation";

interface RetrievedDoc {
  id: number;
  agent_role: string;
  summary: string;
  tags: string[];
  round: number;
  similarity: number;
  project_id?: string;
  project_name?: string;
  source?: "current" | "cross";
}

interface MemoryPanelProps {
  docs: RetrievedDoc[];
}

const ROLE_LABELS: Record<string, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
};

const ROLE_ACCENT: Record<string, string> = {
  pm: "bg-amber-500",
  architect: "bg-blue-500",
  engineer: "bg-emerald-500",
};

export function MemoryPanel({ docs }: MemoryPanelProps) {
  const router = useRouter();

  if (docs.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <Brain className="h-6 w-6 mx-auto mb-2 opacity-30" />
        <p className="text-xs">暂无相关历史记忆</p>
      </div>
    );
  }

  const hasCross = docs.some(d => d.source === "cross");
  const currentDocs = docs.filter(d => d.source !== "cross");
  const crossDocs = docs.filter(d => d.source === "cross");

  const renderCard = (doc: RetrievedDoc) => {
    const pct = Math.round(doc.similarity * 100);
    const isCross = doc.source === "cross";
    return (
      <Card
        key={doc.id}
        className={`p-3 text-xs ${isCross ? "cursor-pointer hover:ring-1 hover:ring-purple-300" : ""}`}
        onClick={() => {
          if (isCross && doc.project_id) {
            router.push(`/workspace/${doc.project_id}`);
          }
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            {isCross && doc.project_name && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-purple-100 text-purple-700">
                {doc.project_name}
              </span>
            )}
            <span className="font-medium">
              {ROLE_LABELS[doc.agent_role] || doc.agent_role}
            </span>
          </div>
          <span className="text-muted-foreground text-[10px]">
            第{doc.round}轮
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed line-clamp-2 mb-2">
          {doc.summary}
        </p>
        {/* Similarity bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${ROLE_ACCENT[doc.agent_role] || "bg-muted-foreground"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right">
            {pct}%
          </span>
        </div>
      </Card>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-2.5">
        {hasCross ? (
          <>
            {currentDocs.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Brain className="h-3.5 w-3.5" />
                  当前项目记忆
                </h3>
                {currentDocs.map(renderCard)}
              </>
            )}
            <h3 className="text-xs font-medium text-purple-600 flex items-center gap-1.5 mb-1 mt-3">
              <Brain className="h-3.5 w-3.5" />
              跨项目经验
            </h3>
            {crossDocs.map(renderCard)}
          </>
        ) : (
          <>
            <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
              <Brain className="h-3.5 w-3.5" />
              相关记忆 ({docs.length})
            </h3>
            {docs.map(renderCard)}
          </>
        )}
      </div>
    </div>
  );
}
