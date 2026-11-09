import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'bullmq';
import { AppDataSource, Document, DocumentChunk, INGEST_QUEUE } from '@repo/db';
import { readFile } from 'node:fs/promises';
import { extractText } from 'unpdf';


import { chunkText } from './chunk.js';
import { embedPassages } from '@repo/ai';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  loadEnvFile(resolve(root, '.env'));
} catch {
  // Root .env is optional when env vars are already set.
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const storagePath = process.env.STORAGE_PATH ?? '';
if (!storagePath) {
  throw new Error('STORAGE_PATH is required');
}

type IngestJob = {
  documentId: string;
};

async function main() {
  await AppDataSource.initialize();
  console.log('[worker] database connected');

  const worker = new Worker<IngestJob>(
    INGEST_QUEUE,
    async (job) => {
      const { documentId } = job.data;
      console.log(`[worker] ingest start documentId=${documentId}`);

      const repo = AppDataSource.getRepository(Document);
      try {
        await repo.update(documentId, { status: 'processing' });

        const doc = await repo.findOneBy({ id: documentId });
        if (!doc || !doc.storageKey) {
          throw new Error(
            `Document ${documentId} missing or has no storageKey`,
          );
        }

        const key = doc.storageKey;
        const buffer = await readFile(resolve(storagePath, key));
        const { text: pages } = await extractText(new Uint8Array(buffer), {
          mergePages: false,
        });

        console.log(`[worker] extracted ${pages.length} pages`);

        const chunks: { content: string; page: number }[] = [];
        pages.forEach((pageText, index) => {
          const pageNumber = index + 1;
          for (const content of chunkText(pageText)) {
            chunks.push({ content, page: pageNumber });
          }
        });

        console.log(`[worker] created ${chunks.length} chunks`);

        if (chunks.length === 0) {
          throw new Error('No extractable text');
        }

        const BATCH = 32;
        const embeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i += BATCH) {
          const batch = chunks.slice(i, i + BATCH).map((c) => c.content);
          const vectors = await embedPassages(batch);
          embeddings.push(...vectors);
        }

        console.log(`[worker] embedded ${embeddings.length} chunks`);

        const chunkRepo = AppDataSource.getRepository(DocumentChunk);
        await chunkRepo.delete({ documentId });
        await chunkRepo.save(
          chunks.map((c, i) =>
            chunkRepo.create({
              documentId,
              content: c.content,
              page: c.page,
              embedding: embeddings[i] ?? null,
            }),
          ),
        );

        await repo.update(documentId, { status: 'processed' });
        console.log(`[worker] ingest done documentId=${documentId}`);
      } catch (err) {
        await repo.update(documentId, { status: 'failed' });
        throw err;
      }
    },
    {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[worker] ingest failed jobId=${job?.id} documentId=${job?.data.documentId}`,
      err,
    );
  });

  console.log(`[worker] listening on queue "${INGEST_QUEUE}"`);
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
