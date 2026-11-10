"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth, type User } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { AppControls } from "@/components/app-controls";
import { apiFetch } from "@/lib/api";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? t.invalidCredentials
            : res.status === 409
              ? t.emailTaken
              : res.status === 429
                ? t.tooManyRequests
                : t.invalidInput,
        );
        return;
      }
      setUser((await res.json()) as User);
      router.replace("/");
    } catch {
      setError(t.apiOffline);
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <FileText className="size-5" />
          {t.appTitle}
        </h1>
        <AppControls />
      </header>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {isLogin ? t.loginTitle : t.registerTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLogin ? t.loginSubtitle : t.registerSubtitle}
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t.email}
              <Input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t.password}
              <PasswordInput
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={isLogin ? undefined : 8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!isLogin ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {t.passwordHint}
                </span>
              ) : null}
            </label>

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {isLogin ? t.loginAction : t.registerAction}
            </Button>

            {error ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? t.noAccount : t.haveAccount}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError(null);
              }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isLogin ? t.registerAction : t.loginAction}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
