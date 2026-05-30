// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/projects");
      else setChecking(false);
    });
  }, []);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/projects");
    }
  };

  const handleSignUp = async () => {
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/projects");
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md p-10 flex flex-col items-center text-center shadow-[var(--shadow-lg)]">
        <div className="h-16 w-16 flex items-center justify-center border-2 border-border bg-primary text-primary-foreground mb-6">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">
          Atoms Studio
        </h1>
        <p className="text-muted-foreground mb-8">
          用一句话描述你的想法,三位 AI 专家将协作为你生成一个可运行的网页应用。
        </p>
        <div className="w-full space-y-3">
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={handleLogin} disabled={loading} className="w-full" size="lg">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            登录
          </Button>
          <Button
            variant="outline"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full !bg-transparent"
            size="lg"
          >
            注册
          </Button>
        </div>
      </Card>
    </div>
  );
}
