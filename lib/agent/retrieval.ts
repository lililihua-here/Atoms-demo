// lib/agent/retrieval.ts
import { createServerSupabase } from "@/lib/supabase/server";
import { embedText, cosineSim, parseVector } from "./embedding";

export interface RetrievedDoc {
  id: number;
  agent_role: string;
  summary: string;
  tags: string[];
  round: number;
  similarity: number;
}

// Load all project docs and perform cosine top-k retrieval
export async function retrieve(
  query: string,
  projectId: string,
  topK: number = 3
): Promise<RetrievedDoc[]> {
  const supabase = createServerSupabase();

  const { data: docs } = await supabase
    .from("agent_documents")
    .select("id, agent_role, summary, tags, round, embedding_json")
    .eq("project_id", projectId)
    .not("summary", "is", null);

  if (!docs || docs.length === 0) return [];

  // Additional client-side project_id guard
  const validDocs = docs.filter((d: any) => String(d.project_id ?? projectId) === String(projectId));

  // Generate query vector
  const queryVec = await embedText(query);
  if (!queryVec) return []; // graceful degradation

  // Score and rank
  const scored = validDocs
    .map((doc: any) => {
      const vec = parseVector(doc.embedding_json);
      if (!vec) return { ...doc, similarity: 0 };
      return { ...doc, similarity: cosineSim(queryVec, vec) };
    })
    .filter((d: any) => d.similarity > 0.1)
    .sort((a: any, b: any) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

// Format retrieval results for agent context
export function formatRetrievedContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) return "";
  const roleName: Record<string, string> = {
    pm: "产品经理",
    architect: "架构师",
    engineer: "工程师",
  };
  const lines = docs.map(
    (d) =>
      `- [${roleName[d.agent_role] ?? d.agent_role}] 第${d.round}轮 (相似度: ${d.similarity.toFixed(2)}): ${d.summary}`
  );
  return `\n\n## 相关历史记忆\n${lines.join("\n")}\n`;
}
