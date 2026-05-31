// lib/agent/constants.ts
// Shared pipeline constants — extracted to avoid circular imports between modules
import type { AgentRole } from "@/lib/models/types";
import { PM_SYSTEM, ARCHITECT_SYSTEM, ENGINEER_SYSTEM, LEAD_SYSTEM } from "./prompts";

export const STAGE_ORDER: AgentRole[] = ["pm", "architect", "engineer", "team_lead"];

export const ROLE_LABELS: Record<string, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
  team_lead: "团队领导",
};

export const ROLE_SYSTEM: Record<string, string> = {
  pm: PM_SYSTEM,
  architect: ARCHITECT_SYSTEM,
  engineer: ENGINEER_SYSTEM,
  team_lead: LEAD_SYSTEM,
};

export const ENGINEER_CONCURRENCY = 3;
export const SUBTASK_TIMEOUT_MS = 120_000;
export const MIN_LEAVES_FOR_PARALLEL = 2;
