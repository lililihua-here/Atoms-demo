// components/chat/MessageBubble.tsx
"use client";

import { useState } from "react";
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
  const displayContent = summary && !expanded ? summary : content;
  const hasMore = summary && content.length > summary.length;

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 border border-border ${
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}>
        {ROLE_ICONS[role] || <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex-1 ${isUser ? "text-right" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {ROLE_LABELS[role] || role}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {streaming && (
            <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
          )}
        </div>
        <Card className={`inline-block max-w-[85%] p-3 text-sm whitespace-pre-wrap text-left ${
          isUser ? "bg-primary text-primary-foreground" : ""
        }`}>
          {displayContent}
        </Card>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 text-xs"
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
