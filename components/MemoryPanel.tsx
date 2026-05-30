// components/MemoryPanel.tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Brain } from "lucide-react";

interface RetrievedDoc {
  id: number;
  agent_role: string;
  summary: string;
  tags: string[];
  round: number;
  similarity: number;
}

interface MemoryPanelProps {
  docs: RetrievedDoc[];
}

const ROLE_LABELS: Record<string, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
};

export function MemoryPanel({ docs }: MemoryPanelProps) {
  if (docs.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Brain className="h-5 w-5 mx-auto mb-2 opacity-40" />
        <p>暂无相关历史记忆</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
          <Brain className="h-3 w-3" /> 相关记忆 ({docs.length})
        </h3>
        {docs.map((doc) => (
          <Card key={doc.id} className="p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">
                {ROLE_LABELS[doc.agent_role] || doc.agent_role}
              </span>
              <span className="text-muted-foreground">
                第{doc.round}轮 · {(doc.similarity * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2">{doc.summary}</p>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
