import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Document, DocumentChunk, INGEST_QUEUE } from '@repo/db';
import { Queue } from 'bullmq';
import { mkdir, writeFile } from 'node:fs/promises';
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
    }> = await this.documents.query(
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

  async chat(documentId: string, question: string) {
    const chunks = await this.search(documentId, question);

    if (chunks.length === 0) {
      return {
        answer: 'não encontrei no documento',
        sources: [],
      };
    }
  
    const answerText = await answer(
      question,
      chunks.map((c) => ({ page: c.page, content: c.content })),
    );
  
    return {
      answer: answerText,
      sources: chunks.map((c, i) => ({
        n: i + 1,
        page: c.page,
        excerpt: toExcerpt(c.content),
      })),
    };
  }

  async chatStream(documentId: string, question: string, res: import('express').Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  
    try {
      const chunks = await this.search(documentId, question);
  
      const sources = chunks.map((c, i) => ({
        n: i + 1,
        page: c.page,
        excerpt: toExcerpt(c.content),
      }));
  
      // formato SSE: linha event, linha data, linha em branco
      res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);
  
      if (chunks.length === 0) {
        res.write(`data: ${JSON.stringify('não encontrei no documento')}\n\n`);
        res.write(`event: done\ndata: \n\n`);
        res.end();
        return;
      }
  
      for await (const text of answerStream(
        question,
        chunks.map((c) => ({ page: c.page, content: c.content })),
      )) {
        res.write(`data: ${JSON.stringify(text)}\n\n`);
      }
  
      res.write(`event: done\ndata: \n\n`);
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed';
      res.write(`event: error\ndata: ${JSON.stringify(message)}\n\n`);
      res.end();
    }
  }
}

/** Short, word-aligned preview of a chunk for the UI. */
function toExcerpt(content: string, max = 200): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return `${text.slice(0, cut > max * 0.6 ? cut : max)}…`;
}
