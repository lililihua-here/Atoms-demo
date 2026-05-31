// lib/agent/retrieval.ts
import { createServerSupabase } from "@/lib/supabase/server";

export interface RetrievedDoc {
  id: number;
  agent_role: string;
  summary: string;
  tags: string[];
  round: number;
  similarity: number;
  project_id?: string;
  project_name?: string;
  source?: "current" | "cross";
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

export async function retrieveCrossProject(
  query: string,
  userId: string,
  excludeProjectId: string,
  topK: number = 3
): Promise<RetrievedDoc[]> {
  const supabase = createServerSupabase();

  // Get all user's projects except current
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId)
    .neq("id", excludeProjectId)
    .not("generated_code", "is", null);  // only completed projects

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);

  // Get docs from all other projects (limit to most recent 200 for performance)
  const { data: docs } = await supabase
    .from("agent_documents")
    .select("id, agent_role, summary, tags, round, project_id")
    .in("project_id", projectIds)
    .not("summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!docs || docs.length === 0) return [];

  // Join project names
  const projectNameMap = new Map(projects.map(p => [p.id, p.name]));

  const scored = docs
    .map((doc: any) => ({
      id: doc.id,
      agent_role: doc.agent_role,
      summary: doc.summary || "",
      tags: doc.tags || [],
      round: doc.round || 1,
      similarity: matchScore(query, doc.summary || "", doc.tags || []),
      project_id: doc.project_id,
      project_name: projectNameMap.get(doc.project_id) || "未知项目",
      source: "cross" as const,
    }))
    .filter(d => d.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity);

  console.log("retrieveCrossProject: found", scored.length, "matches across", projects.length, "projects");
  return scored.slice(0, topK);
}

export function formatRetrievedContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) return "";
  const roleName: Record<string, string> = {
    pm: "产品经理", architect: "架构师", engineer: "工程师", team_lead: "团队领导",
  };
  const currentDocs = docs.filter(d => d.source !== "cross");
  const crossDocs = docs.filter(d => d.source === "cross");

  const parts: string[] = [];

  if (currentDocs.length > 0) {
    const lines = currentDocs.map(d =>
      `- [${roleName[d.agent_role] ?? d.agent_role}] 第${d.round}轮 (相关度: ${d.similarity.toFixed(2)}): ${d.summary}`
    );
    parts.push(`## 相关历史记忆\n${lines.join("\n")}`);
  }

  if (crossDocs.length > 0) {
    const lines = crossDocs.map(d =>
      `- [${d.project_name}] [${roleName[d.agent_role] ?? d.agent_role}] (相关度: ${d.similarity.toFixed(2)}): ${d.summary}`
    );
    parts.push(`## 跨项目经验复用\n${lines.join("\n")}`);
  }

  return "\n\n" + parts.join("\n\n") + "\n";
}
