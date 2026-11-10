"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Language + theme controls (and the signed-in user) shown in page headers. */
export function AppControls() {
  const { user, logout } = useAuth();
  const { t } = useLocale();

  return (
    <div className="flex shrink-0 items-center gap-2">
      {user ? (
        <>
          <span
            className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline"
            title={user.email}
          >
            {user.email}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void logout()}
            aria-label={t.logout}
            title={t.logout}
          >
            <LogOut />
          </Button>
        </>
      ) : null}
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
