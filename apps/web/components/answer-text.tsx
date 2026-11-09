"use client";

import { Fragment, type ReactNode } from "react";

type Props = {
  text: string;
  /** Called when the user clicks a citation like [2]. */
  onCite?: (n: number) => void;
};

/**
 * Minimal markdown renderer for LLM answers: paragraphs, bullet / numbered
 * lists, headings, **bold**, *italic*, `code` and clickable [n] citations.
 * Safe by construction: never uses dangerouslySetInnerHTML.
 */
export function AnswerText({ text, onCite }: Props) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={blocks.length}>{renderInline(para.join(" "), onCite)}</p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => (
        <li key={i}>{renderInline(it, onCite)}</li>
      ));
      blocks.push(
        list.ordered ? (
          <ol key={blocks.length} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={blocks.length} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[*\-•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);

    if (!line) {
      flushPara();
      flushList();
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={blocks.length} className="font-semibold">
          {renderInline(heading[1]!, onCite)}
        </p>,
      );
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\d+(?:\s*,\s*\d+)*\])/g;

function renderInline(text: string, onCite?: (n: number) => void): ReactNode {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-background/60 px-1 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (/^\[\d/.test(part)) {
      const nums = part.slice(1, -1).split(",").map((s) => Number(s.trim()));
      return (
        <Fragment key={i}>
          {nums.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onCite?.(n)}
              className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-background px-1 align-text-top text-[10px] font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {n}
            </button>
          ))}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
