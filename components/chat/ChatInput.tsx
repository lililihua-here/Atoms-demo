// components/chat/ChatInput.tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  busy?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, busy, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    ref.current?.focus();
  };

  return (
    <div className="border-t border-border/20 p-3 flex gap-2 items-end bg-background/50">
      {busy && onStop && (
        <Button
          variant="destructive"
          size="icon"
          onClick={onStop}
          className="shrink-0"
          data-no-shadow
        >
          <Square className="h-4 w-4" />
        </Button>
      )}
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="描述你想要的应用... (Enter 发送, Shift+Enter 换行)"
        className="min-h-[44px] max-h-[120px] resize-none"
        rows={1}
        disabled={disabled}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
