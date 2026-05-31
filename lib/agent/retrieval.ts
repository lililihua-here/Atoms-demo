// lib/agent/retrieval.ts
import { createServerSupabase } from "@/lib/supabase/server";

export interface RetrievedDoc {
  id: number;
  agent_role: string;
  summary: string;
  tags: string[];
  round: number;
  similarity: number;
}

// Simple text-based match score — no LLM embedding needed
function matchScore(query: string, summary: string, tags: string[]): number {
  const searchText = `${summary} ${(tags || []).join(" ")}`.toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;
  // Whole query substring match (strongest signal)
  if (searchText.includes(queryLower)) score += 10;
  // Word-level overlap
  const queryWords = queryLower.split(/[\s,，。！？、]+/).filter(w => w.length > 0);
  for (const word of queryWords) {
    if (searchText.includes(word)) score += 3;
  }
  // Character bigram overlap (fine-grained)
  for (let i = 0; i < queryLower.length - 1; i++) {
    const bigram = queryLower.substring(i, i + 2);
    if (searchText.includes(bigram)) score += 1;
  }
  // Normalize by query length so short and long queries are comparable
  return score / Math.max(1, queryLower.length);
}

export async function retrieve(
  query: string,
  projectId: string,
  topK: number = 3
): Promise<RetrievedDoc[]> {
  const supabase = createServerSupabase();

  const { data: docs } = await supabase
    .from("agent_documents")
    .select("id, agent_role, summary, tags, round")
    .eq("project_id", projectId)
    .not("summary", "is", null);

  if (!docs || docs.length === 0) {
    console.log("retrieve: no docs found for project", projectId);
    return [];
  }

  const validDocs = docs.filter(
    (d: any) => String(d.project_id ?? projectId) === String(projectId)
  );

  const scored = validDocs
    .map((doc: any) => ({
      id: doc.id,
      agent_role: doc.agent_role,
      summary: doc.summary || "",
      tags: doc.tags || [],
      round: doc.round || 1,
      similarity: matchScore(query, doc.summary || "", doc.tags || []),
    }))
    .filter((d) => d.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity);

  console.log("retrieve: found", scored.length, "matches for query:", query.substring(0, 50));
  return scored.slice(0, topK);
}

export function formatRetrievedContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) return "";
  const roleName: Record<string, string> = {
    pm: "产品经理",
    architect: "架构师",
    engineer: "工程师",
  };
  const lines = docs.map(
    (d) =>
      `- [${roleName[d.agent_role] ?? d.agent_role}] 第${d.round}轮 (相关度: ${d.similarity.toFixed(2)}): ${d.summary}`
  );
  return `\n\n## 相关历史记忆\n${lines.join("\n")}\n`;
}
