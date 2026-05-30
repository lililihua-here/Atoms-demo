// components/chat/ChatPanel.tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ChevronDown } from "lucide-react";
import type { Message } from "@/lib/models/types";

interface ChatPanelProps {
  messages: Message[];
  busy: boolean;
  onSend: (message: string) => void;
  onStop?: () => void;
}

export function ChatPanel({ messages, busy, onSend, onStop }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setUserScrolled(false);
  }, []);

  // Auto-scroll on new messages unless user scrolled up
  useEffect(() => {
    if (!userScrolled || busy) {
      scrollToBottom();
    }
  }, [messages, busy, userScrolled, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setUserScrolled(!atBottom);
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="py-3">
          {messages.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-muted/50">
                <svg className="h-8 w-8 text-muted-foreground/30" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <p className="text-lg font-bold mb-1">开始你的创作</p>
              <p className="text-sm text-muted-foreground">
                在下方描述你想要构建的应用，AI 将为你生成代码
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              id={msg.id}
              role={msg.role}
              content={msg.content}
              summary={msg.summary}
              timestamp={msg.timestamp}
              streaming={msg.streaming}
            />
          ))}
        </div>
      </div>

      {/* Scroll-to-bottom FAB */}
      {userScrolled && messages.length > 0 && (
        <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ChatInput onSend={onSend} disabled={busy} busy={busy} onStop={onStop} />
    </div>
  );
}
