"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export type User = { id: string; email: string };

type Ctx = {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

const PUBLIC_PATHS = ["/login"];

/**
 * Loads the current session once and keeps signed-out visitors on /login.
 * The session itself is an httpOnly cookie, so the browser never sees the token.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
      .catch(() => null)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!checked) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
  }, [checked, user, isPublic, router]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, setUser, logout }), [user, logout]);

  const ready = checked && (isPublic ? !user : !!user);

  return (
    <AuthContext.Provider value={value}>
      {ready ? (
        children
      ) : (
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
