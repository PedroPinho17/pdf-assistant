"use client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Language + theme controls shown in every page header. */
export function AppControls() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
