export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all user's project IDs (include generated_code for success rate)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, generated_code")
    .eq("user_id", user.id);

  if (!projects || projects.length === 0) {
    return NextResponse.json({
      totalProjects: 0, totalRounds: 0, totalTokens: 0, estimatedCost: 0,
      successRate: 0, avgDurationMs: 0,
      timeline: [], agentDuration: {}, tokenTrend: [],
    });
  }

  const projectIds = projects.map(p => p.id);

  // Aggregate all agent_documents
  const { data: docs } = await supabase
    .from("agent_documents")
    .select("agent_role, duration_ms, input_tokens, output_tokens, round, project_id, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: true });

  if (!docs || docs.length === 0) {
    return NextResponse.json({
      totalProjects: projects.length, totalRounds: 0, totalTokens: 0, estimatedCost: 0,
      successRate: 0, avgDurationMs: 0,
      timeline: [], agentDuration: {}, tokenTrend: [],
    });
  }

  // Compute metrics
  const totalRounds = new Set(docs.map(d => `${d.project_id}-${d.round}`)).size;
  const totalInputTokens = docs.reduce((s, d) => s + (d.input_tokens || 0), 0);
  const totalOutputTokens = docs.reduce((s, d) => s + (d.output_tokens || 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  // DeepSeek pricing (~$0.27/1M input, ~$1.10/1M output)
  const estimatedCost = (totalInputTokens / 1_000_000) * 0.27 + (totalOutputTokens / 1_000_000) * 1.10;

  // Success rate: projects with generated_code present
  const projectsWithCode = projects.filter(p => p.generated_code && p.generated_code !== "").length;
  const successRate = Math.round((projectsWithCode / projects.length) * 100);

  // Average duration
  const durations = docs.filter(d => d.duration_ms).map(d => d.duration_ms!);
  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : 0;

  // Agent duration breakdown
  const agentDuration: Record<string, number> = {};
  for (const role of ["pm", "architect", "engineer", "team_lead"]) {
    const roleDocs = docs.filter(d => d.agent_role === role && d.duration_ms);
    agentDuration[role] = roleDocs.length > 0
      ? Math.round(roleDocs.reduce((s, d) => s + d.duration_ms!, 0) / roleDocs.length) : 0;
  }

  // Timeline: last 10 runs
  const runs = new Map<string, { projectName: string; round: number; createdAt: string; agents: Record<string, number> }>();
  for (const d of docs) {
    const key = `${d.project_id}-${d.round}`;
    if (!runs.has(key)) {
      const p = projects.find(pr => pr.id === d.project_id);
      runs.set(key, {
        projectName: p?.name || "未知",
        round: d.round,
        createdAt: d.created_at,
        agents: {},
      });
    }
    const entry = runs.get(key)!;
    entry.agents[d.agent_role] = (entry.agents[d.agent_role] || 0) + (d.duration_ms || 0);
  }
  const timeline = Array.from(runs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Token trend (~20 data points)
  let cumulativeTokens = 0;
  const tokenTrend = docs
    .filter(d => d.input_tokens || d.output_tokens)
    .map(d => {
      cumulativeTokens += (d.input_tokens || 0) + (d.output_tokens || 0);
      return { date: d.created_at, tokens: cumulativeTokens };
    })
    .filter((_, i) => i % Math.max(1, Math.floor(docs.length / 20)) === 0);

  return NextResponse.json({
    totalProjects: projects.length, totalRounds, totalTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    successRate, avgDurationMs, timeline, agentDuration, tokenTrend,
  });
}
