// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Key, Loader2 } from "lucide-react";

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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--ink) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <Card className="relative w-full max-w-[420px] p-10 flex flex-col items-center text-center">
        {/* Logo badge */}
        <div className="h-20 w-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: "linear-gradient(135deg, var(--ink) 0%, var(--ink-light) 100%)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <svg className="h-10 w-10 text-[var(--parchment)]" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="3" />
            <path fillRule="evenodd" d="M12 2a1 1 0 0 1 .97.757l.49 1.835a8 8 0 0 1 3.948 3.948l1.835-.49a1 1 0 0 1 1.04 1.665l-1.315.988a8 8 0 0 1 0 4.594l1.315.988a1 1 0 0 1-1.04 1.665l-1.835-.49a8 8 0 0 1-3.948 3.948l.49 1.835A1 1 0 0 1 12 22a1 1 0 0 1-.97-.757l-.49-1.835a8 8 0 0 1-3.948-3.948l-1.835.49a1 1 0 0 1-1.04-1.665l1.315-.988a8 8 0 0 1 0-4.594l-1.315-.988a1 1 0 0 1 1.04-1.665l1.835.49a8 8 0 0 1 3.948-3.948l.49-1.835A1 1 0 0 1 12 2z" clipRule="evenodd" />
          </svg>
        </div>

        <h1 className="text-[2rem] font-bold text-foreground mb-1 tracking-tight">
          Atoms Studio
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-[280px]">
          用一句话描述你的想法，三位 AI 专家将协作生成可运行的应用
        </p>

        <div className="w-full space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="pl-10 h-11"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border-2 border-destructive/30 text-destructive text-sm rounded px-3 py-2 text-left">
              {error}
            </div>
          )}

          {/* Login button */}
          <Button
            onClick={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full h-11 text-base"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            登录
          </Button>

          {/* Sign up link */}
          <p className="text-sm text-muted-foreground">
            还没有账号？{" "}
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="font-medium text-foreground underline underline-offset-2 hover:text-ink-light transition-colors"
            >
              立即注册
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}
