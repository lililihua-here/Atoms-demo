// app/projects/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit3, Trash2, LogOut, Sparkles } from "lucide-react";

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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center border-2 border-border bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-serif font-bold">Atoms Studio</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" /> 退出
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-serif font-bold">我的项目</h2>
            <p className="text-muted-foreground mt-1">
              用自然语言描述需求,AI 协作为你生成网页应用
            </p>
          </div>
          <Button
            onClick={() => {
              setName("");
              setDescription("");
              setCreateOpen(true);
            }}
            size="lg"
          >
            <Plus className="h-5 w-5 mr-1" /> 新建项目
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg">还没有项目</p>
            <p className="text-sm mt-1">点击「新建项目」开始你的第一个 AI 生成应用</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="p-5 cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow"
                onClick={() => router.push(`/workspace/${p.id}`)}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-serif font-bold text-lg truncate flex-1">{p.name}</h3>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setName(p.name);
                        setDescription(p.description);
                        setEditOpen(p);
                      }}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500"
                      onClick={() => setDeleteOpen(p)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {p.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  {new Date(p.created_at).toLocaleDateString("zh-CN")}
                </p>
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
          <div className="space-y-3">
            <Input placeholder="项目名称" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="项目描述（可选）" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建并进入
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="项目名称" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="项目描述" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Button onClick={handleUpdate} disabled={saving || !name.trim()} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOpen} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除项目「{deleteOpen?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
