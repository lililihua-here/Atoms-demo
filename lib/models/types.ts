// lib/models/types.ts
export type AgentRole = "pm" | "architect" | "engineer" | "team_lead";
export type StageStatus = "pending" | "running" | "completed" | "failed";
export type ParallelTaskStatus = "running" | "success" | "failed" | "placeholder";

export interface StageState {
  stage: AgentRole;
  status: StageStatus;
  summary?: string;
  error?: string;
}

export interface ParallelTaskState {
  componentName: string;
  status: ParallelTaskStatus;
  error?: string;
}

export interface Message {
  id: string;
  role: "user" | AgentRole | "system";
  content: string;
  summary?: string;
  timestamp: string;
  streaming?: boolean;
}

export interface AgentDocument {
  id: number;
  project_id: number | string;
  agent_role: string;
  content: string;
  summary: string;
  tags: string[];
  round: number;
  embedding_json: string | null;
  duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

export interface ProjectRecord {
  id: number;
  user_id: string;
  name: string;
  description: string;
  generated_code: string;
  shared_json: any;
  created_at: string;
  updated_at: string;
}

export interface PipelineContext {
  projectId: string;
  userId: string;
  userMessage: string;
  round: number;
  previousCode?: string;
}

export interface PipelineCallbacks {
  onStageStart: (stage: AgentRole) => void;
  onChunk: (stage: AgentRole, text: string) => void;
  onStageComplete: (stage: AgentRole, output: string, summary: string) => void;
  onStagePersist: (stage: AgentRole, doc: AgentDocument) => void;
  onCode: (code: string) => void;
  onError: (stage: AgentRole, error: string) => void;
  onRetrieve: (docs: any[]) => void;
  onParallelStart: (tasks: ParallelTaskState[]) => void;
  onParallelUpdate: (task: ParallelTaskState) => void;
  onParallelEnd: () => void;
}
