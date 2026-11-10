"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eraser,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";
import { API_URL, apiFetch } from "@/lib/api";
import { AnswerText } from "@/components/answer-text";
import { AppControls } from "@/components/app-controls";
import { StatusBadge } from "@/components/status-badge";

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

const MAX_QUESTION_LENGTH = 1000; // must match the API limit

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useLocale();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [copied, setCopied] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Document details (polls until processing finishes)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await apiFetch(`/documents/${id}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Doc;
        if (cancelled) return;
        setDoc(data);
        if (data.status !== "processed" && data.status !== "failed") {
          timer = setTimeout(load, 2000);
        }
      } catch {
        if (!cancelled) setError(t.loadError);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, t.loadError]);

  // Saved conversation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/documents/${id}/messages`);
        if (!res.ok) return;
        const data = (await res.json()) as ChatMessage[];
        if (!cancelled) setMessages(data);
      } catch {
        // history is optional; chat still works without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateLast(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      return [...prev.slice(0, -1), fn(last)];
    });
  }

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || asking) return;

    setAsking(true);
    setError(null);
    setQuestion("");
    setMessages((prev) => [...prev, { question: q, answer: "", sources: [] }]);

    try {
      const res = await apiFetch(`/documents/${id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, locale }),
      });
      if (!res.ok || !res.body) {
        throw new Error(res.status === 429 ? t.tooManyRequests : t.chatFailed);
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
          let eventName = "message";
          let dataLine: string | null = null;

          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim();
            }
          }

          if (eventName === "done") continue;
          if (!dataLine) continue;

          if (eventName === "sources") {
            const sources = JSON.parse(dataLine) as ChatMessage["sources"];
            updateLast((m) => ({ ...m, sources }));
          } else if (eventName === "error") {
            throw new Error(JSON.parse(dataLine) as string);
          } else {
            const text = JSON.parse(dataLine) as string;
            updateLast((m) => ({ ...m, answer: m.answer + text }));
          }
        }
      }
    } catch (err) {
      // TypeError = network failure; other errors carry an already-localized message
      setError(
        err instanceof TypeError
          ? t.apiOffline
          : err instanceof Error
            ? err.message
            : t.chatFailed,
      );
    } finally {
      setAsking(false);
    }
  }

  async function copyAnswer(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      // clipboard not available (e.g. insecure context)
    }
  }

  async function clearChat() {
    if (!window.confirm(t.confirmClearChat)) return;
    const res = await apiFetch(`/documents/${id}/messages`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) setMessages([]);
    else setError(t.deleteFailed);
  }

  async function deleteDocument() {
    if (!window.confirm(t.confirmDelete)) return;
    const res = await apiFetch(`/documents/${id}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) router.push("/");
    else setError(t.deleteFailed);
  }

  const fileUrl = `${API_URL}/documents/${id}/file`;
  const ready = doc?.status === "processed";
  const suggestions = [t.suggestion1, t.suggestion2, t.suggestion3];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:h-svh">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
          </Button>
          <h1 className="flex min-w-0 items-center gap-2 font-semibold">
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{doc?.filename ?? t.document}</span>
          </h1>
          <StatusBadge status={doc?.status} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={deleteDocument}
            aria-label={t.deleteDocument}
            title={t.deleteDocument}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
          <AppControls />
        </div>
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
          <div className="flex h-11 items-center justify-between border-b px-4">
            <span className="text-sm font-medium">{t.ask}</span>
            {messages.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearChat}
                disabled={asking}
                className="text-muted-foreground"
              >
                <Eraser />
                {t.clearChat}
              </Button>
            ) : null}
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {doc?.status === "failed" ? (
              <p className="text-sm text-destructive">{t.failedPdf}</p>
            ) : !ready ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t.processing}
              </p>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Sparkles className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t.emptyChat}</p>
                <div className="flex w-full max-w-sm flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t.suggestionsTitle}
                  </span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const cite = (n: number) => {
                  const page = m.sources.find((s) => s.n === n)?.page;
                  if (page != null) setPdfPage(page);
                };
                const streaming = asking && i === messages.length - 1;
                return (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                      {m.question}
                    </div>
                    <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed">
                      {m.answer ? (
                        <AnswerText text={m.answer} onCite={cite} />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {m.answer && !streaming ? (
                      <div className="flex max-w-[90%] items-start gap-3 self-start">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => copyAnswer(i, m.answer)}
                          className="text-muted-foreground"
                        >
                          {copied === i ? <Check /> : <Copy />}
                          {copied === i ? t.copied : t.copy}
                        </Button>
                        {m.sources.length > 0 ? (
                          <details className="group min-w-0 flex-1 text-xs">
                            <summary className="flex h-6 cursor-pointer list-none items-center text-muted-foreground select-none hover:text-foreground">
                              <span className="mr-1 inline-block transition-transform group-open:rotate-90">
                                ›
                              </span>
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
                                    —{" "}
                                    <span className="line-clamp-2 inline">
                                      {s.excerpt}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="flex flex-col gap-1 border-t p-3"
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
                placeholder={t.askPlaceholder}
                maxLength={MAX_QUESTION_LENGTH}
                disabled={!ready}
                rows={1}
                className="max-h-40"
              />
              <Button
                type="submit"
                size="lg"
                disabled={!ready || asking || !question.trim()}
              >
                {asking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span className="sr-only sm:not-sr-only">{t.send}</span>
              </Button>
            </div>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              {t.newLineHint}
            </span>
          </form>
        </section>
      </div>
    </main>
  );
}
