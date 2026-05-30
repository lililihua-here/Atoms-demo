// lib/agent/classify.ts
// Rule-based intent classifier — no server dependencies, safe for client import

import type { AgentRole } from "@/lib/models/types";

export function classifyIntent(userMessage: string): AgentRole[] {
  // Bug fix / minor tweak → engineer only
  if (/修|改|bug|错误|崩|不行|坏了|调|样式|颜色|大小|字体|边距|padding|margin|对齐|居中|改小|改大|修复|fix/i.test(userMessage)) {
    return ["engineer"];
  }
  // Layout/component restructure → architect + engineer
  if (/架构|组件|拆分|重构|布局|结构|新增.*组件|加.*组件|删.*组件|合并|分离|重新组织/i.test(userMessage)) {
    return ["architect", "engineer"];
  }
  // Default → full pipeline
  return ["pm", "architect", "engineer"];
}

export function parseDispatch(output: string): AgentRole[] | null {
  const m = output.match(/```dispatch\s*\n?(\{[\s\S]*?\})\s*```/i);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    if (Array.isArray(parsed.agents)) return parsed.agents;
  } catch {}
  return null;
}
