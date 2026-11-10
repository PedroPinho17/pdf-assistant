"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { AppControls } from "@/components/app-controls";
import { StatusBadge } from "@/components/status-badge";

type DocListItem = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
};

const api = process.env.NEXT_PUBLIC_API_URL;

function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export default function Home() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${api}/documents`);
        if (!res.ok) return;
        const data = (await res.json()) as DocListItem[];
        if (!cancelled) setDocs(data);
      } catch {
        // ignore list errors on home
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!isPdf(f)) {
      setError(t.pdfOnly);
      return;
    }
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t.choosePdf);
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`${api}/documents/upload`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { id: string };
      router.push(`/documents/${data.id}`);
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch() throws TypeError ("Failed to fetch") when the API is unreachable
        setError(t.apiOffline);
      } else {
        setError(err instanceof Error ? err.message : t.uploadFailed);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(doc: DocListItem) {
    if (!window.confirm(`${t.confirmDelete}\n\n${doc.filename}`)) return;
    try {
      const res = await fetch(`${api}/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      setError(t.deleteFailed);
    }
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="size-6" />
            {t.appTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        <AppControls />
      </header>

      <Card className="w-full">
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-10 text-center transition-colors hover:border-ring hover:bg-muted/50",
                dragging && "border-primary bg-muted",
              )}
            >
              <Upload
                className={cn(
                  "size-8 text-muted-foreground transition-transform",
                  dragging && "scale-110 text-foreground",
                )}
              />
              <span className="max-w-full truncate text-sm font-medium">
                {dragging ? t.dropHere : (file?.name ?? t.dropHint)}
              </span>
              <span className="text-xs text-muted-foreground">{t.pdfOnly}</span>
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.currentTarget.files?.[0])}
              />
            </label>
            <Button type="submit" size="lg" disabled={loading || !file}>
              {loading ? t.uploading : t.upload}
            </Button>
            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {docs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t.yourDocuments}
          </h2>
          <ul className="flex w-full flex-col gap-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="group flex items-center gap-2 rounded-lg border bg-card pr-2 transition-colors hover:bg-muted"
              >
                <Link
                  href={`/documents/${d.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-sm"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{d.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {dateFormat.format(new Date(d.createdAt))}
                    </span>
                  </span>
                </Link>
                <StatusBadge status={d.status} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(d)}
                  aria-label={t.deleteDocument}
                  title={t.deleteDocument}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
