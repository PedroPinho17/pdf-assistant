"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/locale-provider";
import { AnswerText } from "@/components/answer-text";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Doc = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
};

type ChatMessage = {
  question: string;
  answer: string;
  sources: { n: number; page: number | null; excerpt: string }[];
};

const api = process.env.NEXT_PUBLIC_API_URL;

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLocale();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch(`${api}/documents/${id}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Doc;
        if (cancelled) return;
        setDoc(data);
        if (data.status !== "processed" && data.status !== "failed") {
          timer = setTimeout(load, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.loadError);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, t.loadError]);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setAsking(true);
    setError(null);
    setQuestion("");

    setMessages((prev) => [
      ...prev,
      { question: q, answer: "", sources: [] },
    ]);

    try {
      const res = await fetch(`${api}/documents/${id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, locale }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "message";
          let dataLine: string | null = null;

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim();
            }
          }

          if (eventName === "sources" && dataLine) {
            const sources = JSON.parse(dataLine) as ChatMessage["sources"];
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (!last) return prev;
              next[next.length - 1] = { ...last, sources };
              return next;
            });
          } else if (eventName === "error" && dataLine) {
            throw new Error(JSON.parse(dataLine) as string);
          } else if (eventName === "done") {
            // stream finished
          } else if (dataLine) {
            const text = JSON.parse(dataLine) as string;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (!last) return prev;
              next[next.length - 1] = {
                ...last,
                answer: last.answer + text,
              };
              return next;
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chatFailed);
    } finally {
      setAsking(false);
    }
  }

  const fileUrl = `${api}/documents/${id}/file`;
  const ready = doc?.status === "processed";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:h-svh">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4" />
              {t.back}
            </Link>
          </Button>
          <h1 className="flex min-w-0 items-center gap-2 font-semibold">
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{doc?.filename ?? t.document}</span>
          </h1>
          <Badge variant={doc?.status === "failed" ? "destructive" : "secondary"}>
            {doc?.status ?? t.loading}
          </Badge>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        {/* PDF preview */}
        <section className="flex h-[70svh] flex-col overflow-hidden rounded-xl border bg-card lg:h-auto lg:min-h-0">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">{t.preview}</span>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t.openInTab}
              <ExternalLink className="size-3" />
            </a>
          </div>
          <iframe
            key={pdfPage}
            src={`${fileUrl}#page=${pdfPage}`}
            title={doc?.filename ?? t.preview}
            className="w-full flex-1 bg-muted"
          />
        </section>

        {/* Chat */}
        <section className="flex h-[70svh] flex-col overflow-hidden rounded-xl border bg-card lg:h-auto lg:min-h-0">
          <div className="border-b px-4 py-2 text-sm font-medium">{t.ask}</div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {doc?.status === "failed" ? (
              <p className="text-sm text-destructive">{t.failedPdf}</p>
            ) : !ready ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t.processing}
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.emptyChat}</p>
            ) : (
              messages.map((m, i) => {
                const cite = (n: number) => {
                  const page = m.sources.find((s) => s.n === n)?.page;
                  if (page != null) setPdfPage(page);
                };
                return (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {m.question}
                    </div>
                    <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed">
                      {m.answer ? (
                        <AnswerText text={m.answer} onCite={cite} />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {m.sources.length > 0 ? (
                      <details className="group max-w-[90%] self-start text-xs">
                        <summary className="cursor-pointer list-none text-muted-foreground select-none hover:text-foreground">
                          <span className="inline-block transition-transform group-open:rotate-90">›</span>{" "}
                          {t.sources} ({m.sources.length})
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1">
                          {m.sources.map((s) => (
                            <li key={s.n}>
                              <button
                                type="button"
                                disabled={s.page == null}
                                onClick={() => cite(s.n)}
                                className="w-full rounded-md border px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                              >
                                <span className="font-medium text-foreground">
                                  [{s.n}] {t.page} {s.page ?? "?"}
                                </span>{" "}
                                — <span className="line-clamp-2 inline">{s.excerpt}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                );
              })
            )}
            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={onAsk} className="flex gap-2 border-t p-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.askPlaceholder}
              disabled={!ready}
            />
            <Button type="submit" disabled={!ready || asking || !question.trim()}>
              {asking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="sr-only sm:not-sr-only">{t.send}</span>
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
