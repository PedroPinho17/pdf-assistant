"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant={locale === "pt" ? "default" : "outline"}
        size="sm"
        onClick={() => setLocale("pt")}
      >
        PT
      </Button>
      <Button
        type="button"
        variant={locale === "en" ? "default" : "outline"}
        size="sm"
        onClick={() => setLocale("en")}
      >
        EN
      </Button>
    </div>
  );
}
