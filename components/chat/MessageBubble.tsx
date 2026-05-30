// components/chat/MessageBubble.tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, User, Bot, Sparkles, PenTool, Code2 } from "lucide-react";
import type { AgentRole } from "@/lib/models/types";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  pm: <Sparkles className="h-4 w-4" />,
  architect: <PenTool className="h-4 w-4" />,
  engineer: <Code2 className="h-4 w-4" />,
  system: <Bot className="h-4 w-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-primary text-primary-foreground",
  pm: "bg-amber-100 text-amber-800",
  architect: "bg-blue-100 text-blue-800",
  engineer: "bg-emerald-100 text-emerald-800",
  system: "bg-muted text-muted-foreground",
};

const ROLE_LABELS: Record<string, string> = {
  user: "你",
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
  system: "系统",
};

interface MessageBubbleProps {
  id: string;
  role: "user" | AgentRole | "system";
  content: string;
  summary?: string;
  timestamp: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, summary, timestamp, streaming }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  const isUser = role === "user";
  const hasSummary = !!summary;
  const displayContent = hasSummary && !expanded ? summary! : content;

  // Esc to collapse expanded message
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div className={`flex gap-3 px-4 py-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs ${
        ROLE_COLORS[role] || ROLE_COLORS.system
      }`}>
        {ROLE_ICONS[role] || <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-medium text-muted-foreground">
            {ROLE_LABELS[role] || role}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {streaming && (
            <span className="flex gap-0.5 items-end h-3">
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          )}
        </div>

        {/* Bubble */}
        <Card className={`inline-block max-w-[85%] p-3 text-sm whitespace-pre-wrap text-left ${
          isUser ? "bg-primary text-primary-foreground border-primary" : "bg-card"
        }`}>
          {displayContent}
          {streaming && !displayContent && (
            <span className="inline-block w-2 h-4 bg-primary/40 animate-pulse" />
          )}
        </Card>

        {/* Expand/Collapse */}
        {hasSummary && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> 收起</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> 展开完整输出</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
