// app/projects/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit3, Trash2, LogOut, Code2, Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  generated_code: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userChecked, setUserChecked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
      else setUserChecked(true);
    });
  }, []);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setProjects((data || []) as Project[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (userChecked) loadProjects();
  }, [userChecked, loadProjects]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        description: description.trim(),
        shared_json: { version: 0, round: 0 },
      })
      .select()
      .single();
    setSaving(false);
    if (data) {
      setCreateOpen(false);
      setName("");
      setDescription("");
      router.push(`/workspace/${data.id}`);
    }
  };

  const handleUpdate = async () => {
    if (!editOpen || !name.trim()) return;
    setSaving(true);
    await supabase
      .from("projects")
      .update({ name: name.trim(), description: description.trim(), updated_at: new Date().toISOString() })
      .eq("id", editOpen.id);
    setSaving(false);
    setEditOpen(null);
    loadProjects();
  };

  const handleDelete = async () => {
    if (!deleteOpen) return;
    await supabase.from("agent_documents").delete().eq("project_id", deleteOpen.id);
    await supabase.from("projects").delete().eq("id", deleteOpen.id);
    setDeleteOpen(null);
    loadProjects();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!userChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--ink) 0%, var(--ink-light) 100%)" }}>
            <svg className="h-5 w-5 text-[var(--parchment)]" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h1 className="text-lg font-bold">Atoms Studio</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1.5" /> 退出
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold mb-1">我的项目</h2>
            <p className="text-muted-foreground text-sm">
              用自然语言描述需求，AI 协作为你生成网页应用
            </p>
          </div>
          <Button
            onClick={() => { setName(""); setDescription(""); setCreateOpen(true); }}
            className="h-11 px-5"
          >
            <Plus className="h-5 w-5 mr-1.5" /> 新建项目
          </Button>
        </div>

        {/* Empty state */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-24 w-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-muted/50">
              <Code2 className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-xl font-bold text-foreground mb-1">还没有项目</p>
            <p className="text-muted-foreground text-sm mb-6">
              点击「新建项目」开始你的第一个 AI 生成应用
            </p>
            <Button
              variant="outline"
              onClick={() => { setName(""); setDescription(""); setCreateOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> 创建第一个项目
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="group p-5 cursor-pointer hover:-translate-y-0.5"
                onClick={() => router.push(`/workspace/${p.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg truncate flex-1 pr-2">{p.name}</h3>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setName(p.name); setDescription(p.description); setEditOpen(p); }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteOpen(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.description ? (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic mb-3">暂无描述</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(p.created_at).toLocaleDateString("zh-CN", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="项目名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="项目描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建并进入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={(open) => !open && setEditOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="项目名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="项目描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(null)}>取消</Button>
            <Button onClick={handleUpdate} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除项目「{deleteOpen?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
