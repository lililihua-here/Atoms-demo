"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, BarChart3, Clock, Coins, Zap, CheckCircle } from "lucide-react";
import Link from "next/link";

interface Stats {
  totalProjects: number;
  totalRounds: number;
  totalTokens: number;
  estimatedCost: number;
  successRate: number;
  avgDurationMs: number;
  timeline: { projectName: string; round: number; agents: Record<string, number> }[];
  agentDuration: Record<string, number>;
  tokenTrend: { date: string; tokens: number }[];
}

const ROLE_LABELS: Record<string, string> = {
  team_lead: "团队领导", pm: "产品经理", architect: "架构师", engineer: "工程师",
};
const ROLE_COLORS: Record<string, string> = {
  team_lead: "#a855f7", pm: "#f59e0b", architect: "#3b82f6", engineer: "#10b981",
};

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载失败，请刷新重试</p>
      </div>
    );
  }

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  // Max timeline bar width
  const maxTimelineMs = Math.max(
    ...stats.timeline.map(t => Object.values(t.agents).reduce((s, v) => s + v, 0)),
    1
  );

  // Max token for sparkline
  const maxTokens = stats.tokenTrend.length > 0
    ? Math.max(...stats.tokenTrend.map(t => t.tokens))
    : 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">可观测性仪表盘</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-3.5 w-3.5" /> 项目数
            </div>
            <p className="text-2xl font-bold">{stats.totalProjects}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> 总轮次
            </div>
            <p className="text-2xl font-bold">{stats.totalRounds}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Coins className="h-3.5 w-3.5" /> Token 消耗
            </div>
            <p className="text-2xl font-bold">{formatTokens(stats.totalTokens)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-3.5 w-3.5" /> 成功率
            </div>
            <p className="text-2xl font-bold">{stats.successRate}%</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" /> 估算费用
            </div>
            <p className="text-2xl font-bold">${stats.estimatedCost.toFixed(2)}</p>
          </Card>
        </div>

        {/* Agent duration bars */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">Agent 平均耗时</h2>
          <div className="space-y-2">
            {Object.entries(stats.agentDuration).map(([role, ms]) => (
              <div key={role} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{ROLE_LABELS[role] || role}</span>
                <div className="flex-1 h-5 bg-muted overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      minWidth: 3,
                      width: `${Math.min(100, (ms / Math.max(...Object.values(stats.agentDuration), 1)) * 100)}%`,
                      backgroundColor: ROLE_COLORS[role] || "#888",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">{formatMs(ms)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">最近流水线时间线</h2>
          {stats.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {stats.timeline.map((t, i) => {
                const totalMs = Object.values(t.agents).reduce((s, v) => s + v, 0);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 truncate">{t.projectName}</span>
                    <span className="text-[10px] text-muted-foreground w-8">R{t.round}</span>
                    <div className="flex-1 h-4 flex bg-muted overflow-hidden">
                      {Object.entries(t.agents).map(([role, ms]) => (
                        <div
                          key={role}
                          title={`${ROLE_LABELS[role]}: ${formatMs(ms)}`}
                          style={{
                            minWidth: 3,
                            width: `${(ms / maxTimelineMs) * 100}%`,
                            backgroundColor: ROLE_COLORS[role] || "#888",
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground w-12 text-right">{formatMs(totalMs)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Legend */}
          <div className="flex gap-3 mt-3">
            {Object.entries(ROLE_COLORS).map(([role, color]) => (
              <div key={role} className="flex items-center gap-1">
                <div className="w-3 h-3" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Token trend sparkline */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">Token 消耗趋势</h2>
          {stats.tokenTrend.length < 2 ? (
            <p className="text-sm text-muted-foreground">数据不足，需要更多流水线运行</p>
          ) : (
            <div>
              <svg viewBox={`0 0 ${stats.tokenTrend.length * 20} 100`} className="w-full h-24">
                <polyline
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2"
                  points={stats.tokenTrend
                    .map((t, i) => `${i * 20},${100 - (t.tokens / maxTokens) * 90}`)
                    .join(" ")}
                />
                {stats.tokenTrend.map((t, i) => (
                  <circle
                    key={i}
                    cx={i * 20}
                    cy={100 - (t.tokens / maxTokens) * 90}
                    r="2"
                    fill="var(--ink)"
                  />
                ))}
              </svg>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{stats.tokenTrend[0]?.date ? new Date(stats.tokenTrend[0].date).toLocaleDateString("zh-CN") : ""}</span>
                <span>{formatTokens(maxTokens)} tokens</span>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
