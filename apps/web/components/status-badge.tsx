"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

const STYLES = {
  pending: {
    icon: Clock,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  processing: {
    icon: Loader2,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  },
  processed: {
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  failed: {
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
} as const;

type Status = keyof typeof STYLES;

export function StatusBadge({ status }: { status?: string }) {
  const { t } = useLocale();
  const key: Status = status && status in STYLES ? (status as Status) : "pending";
  const { icon: Icon, className } = STYLES[key];
  const label = {
    pending: t.statusPending,
    processing: t.statusProcessing,
    processed: t.statusProcessed,
    failed: t.statusFailed,
  }[key];

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <Icon className={cn("size-3", key === "processing" && "animate-spin")} />
      {status ? label : t.loading}
    </span>
  );
}
