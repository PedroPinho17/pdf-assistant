"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/locale-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

type DocListItem = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
};

export default function Home() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/documents`,
        );
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError(t.choosePdf);
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/upload`,
        { method: "POST", body },
      );
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
        <LocaleSwitcher />
      </header>

      <Card className="w-full">
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-10 text-center transition-colors hover:border-ring hover:bg-muted/50">
              <Upload className="size-8 text-muted-foreground" />
              <span className="max-w-full truncate text-sm font-medium">
                {fileName ?? t.dropHint}
              </span>
              <span className="text-xs text-muted-foreground">{t.pdfOnly}</span>
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  setError(null);
                  setFileName(e.currentTarget.files?.[0]?.name ?? null);
                }}
              />
            </label>
            <Button type="submit" size="lg" disabled={loading || !fileName}>
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
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{d.filename}</span>
                  </span>
                  <Badge variant="secondary">{d.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
