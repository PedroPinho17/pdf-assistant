import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ChatMessage,
  type ChatSource,
  Document,
  DocumentChunk,
  INGEST_QUEUE,
} from '@repo/db';
import { Queue } from 'bullmq';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Repository } from 'typeorm';

import { answer, answerStream, embedQuery } from '@repo/ai';
import { reciprocalRankFusion } from './rrf';

type UploadedPdf = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class DocumentsService {
  private readonly storageDir: string;

  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunks: Repository<DocumentChunk>,
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    @InjectQueue(INGEST_QUEUE) private readonly ingestQueue: Queue,
    config: ConfigService,
  ) {
    const configured = config.get<string>('STORAGE_PATH');
    this.storageDir =
      configured && configured.length > 0
        ? resolve(configured)
        : resolve(__dirname, '../../../../storage');
  }

  async upload(file: UploadedPdf): Promise<Document> {
    await mkdir(this.storageDir, { recursive: true });

    const storageKey = `${randomUUID()}.pdf`;
    await writeFile(resolve(this.storageDir, storageKey), file.buffer);

    const document = await this.documents.save(
      this.documents.create({
        filename: file.originalname,
        storageKey,
        status: 'pending',
      }),
    );

    await this.ingestQueue.add(
      'ingest',
      { documentId: document.id },
      { removeOnComplete: 100, removeOnFail: 50 },
    );

    return document;
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documents.findOneBy({ id });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return document;
  }

  async getFilePath(id: string): Promise<{ path: string; filename: string }> {
    const document = await this.findOne(id);
    if (!document.storageKey) {
      throw new NotFoundException(`Document ${id} has no file`);
    }
    return {
      path: resolve(this.storageDir, document.storageKey),
      filename: document.filename,
    };
  }

  async findAll() {
    return this.documents.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async search(documentId: string, q: string) {
    await this.findOne(documentId);
  
    const queryEmbedding = await embedQuery(q);
    const vector = `[${queryEmbedding.join(',')}]`;
  
    const rows: Array<{
      id: string;
      page: number | null;
      content: string;
      score: number;
    }> = await this.documents.manager.transaction(async (tx) => {
      // With the HNSW index, the WHERE filter is applied after the index scan,
      // which could return fewer than LIMIT rows. pgvector >= 0.8 iterative
      // scans keep searching until enough rows match, in exact distance order.
      await tx.query(`SET LOCAL hnsw.iterative_scan = strict_order`);
      return tx.query(
        `
        SELECT id, page, content, 1 - (embedding <=> $1::vector) AS score
        FROM document_chunks
        WHERE "documentId" = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 20
        `,
        [vector, documentId],
      );
    });

    const keywordRows: Array<{
      id: string;
      page: number | null;
      content: string;
      score: number;
    }> = await this.documents.query(
      `
      SELECT
        id,
        page,
        content,
        ts_rank(tsv, websearch_to_tsquery('portuguese', $1)) AS score
      FROM document_chunks
      WHERE "documentId" = $2
        AND tsv @@ websearch_to_tsquery('portuguese', $1)
      ORDER BY score DESC
      LIMIT 20
      `,
      [q, documentId],
    );
  
    const fused = reciprocalRankFusion([rows, keywordRows], 60, 5);

    return fused.map((row) => ({
      page: row.page,
      score: row.score,
      content: row.content,
    }));
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    // Chunks and chat messages are removed by ON DELETE CASCADE.
    await this.documents.delete(id);
    if (document.storageKey) {
      await unlink(resolve(this.storageDir, document.storageKey)).catch(
        (err: NodeJS.ErrnoException) => {
          if (err.code !== 'ENOENT') throw err;
        },
      );
    }
  }

  async listMessages(documentId: string) {
    await this.findOne(documentId);
    const rows = await this.messages.find({
      where: { documentId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      id: m.id,
      question: m.question,
      answer: m.answer,
      sources: m.sources,
      createdAt: m.createdAt,
    }));
  }

  async clearMessages(documentId: string): Promise<void> {
    await this.findOne(documentId);
    await this.messages.delete({ documentId });
  }

  private async saveMessage(
    documentId: string,
    question: string,
    answer: string,
    sources: ChatSource[],
  ) {
    await this.messages.save(
      this.messages.create({ documentId, question, answer, sources }),
    );
  }

  async chat(documentId: string, question: string, locale?: string) {
    const chunks = await this.search(documentId, question);
    const sources = toSources(chunks);

    const answerText =
      chunks.length === 0
        ? notFoundMessage(locale)
        : await answer(
            question,
            chunks.map((c) => ({ page: c.page, content: c.content })),
          );

    await this.saveMessage(documentId, question, answerText, sources);
    return { answer: answerText, sources };
  }

  async chatStream(
    documentId: string,
    question: string,
    res: import('express').Response,
    locale?: string,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown, event?: string) =>
      res.write(
        `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`,
      );

    try {
      const chunks = await this.search(documentId, question);
      const sources = toSources(chunks);

      // SSE format: optional "event:" line, "data:" line, blank line
      send(sources, 'sources');

      let full = '';
      if (chunks.length === 0) {
        full = notFoundMessage(locale);
        send(full);
      } else {
        for await (const text of answerStream(
          question,
          chunks.map((c) => ({ page: c.page, content: c.content })),
        )) {
          full += text;
          send(text);
        }
      }

      await this.saveMessage(documentId, question, full, sources);
      send('', 'done');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed';
      send(message, 'error');
      res.end();
    }
  }
}

function toSources(chunks: { page: number | null; content: string }[]) {
  return chunks.map((c, i) => ({
    n: i + 1,
    page: c.page,
    excerpt: toExcerpt(c.content),
  }));
}

/** Short, word-aligned preview of a chunk for the UI. */
function toExcerpt(content: string, max = 200): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return `${text.slice(0, cut > max * 0.6 ? cut : max)}…`;
}

/** Fallback shown when the search returns no chunks (the LLM is not called). */
function notFoundMessage(locale?: string): string {
  return locale === 'en'
    ? "I couldn't find this in the document."
    : 'Não encontrei isto no documento.';
}
