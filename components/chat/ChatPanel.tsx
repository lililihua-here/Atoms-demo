// components/chat/ChatPanel.tsx
"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Message } from "@/lib/models/types";

interface ChatPanelProps {
  messages: Message[];
  busy: boolean;
  onSend: (message: string) => void;
}

export function ChatPanel({ messages, busy, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="py-2">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12 px-4">
              <p className="text-lg font-serif">开始你的创作</p>
              <p className="text-sm mt-1">在下方描述你想要构建的应用</p>
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
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <ChatInput onSend={onSend} disabled={busy} />
    </div>
  );
}
