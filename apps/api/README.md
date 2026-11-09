# API

NestJS REST API for PDF Assistant.

- Receives PDF uploads, stores them and queues an ingestion job (BullMQ)
- Hybrid search over document chunks: pgvector similarity + PostgreSQL full-text, merged with Reciprocal Rank Fusion
- Answers questions with Google Gemini, streamed to the client via Server-Sent Events

```bash
pnpm --filter api start:dev   # http://localhost:3001
pnpm --filter api test
```

See the [root README](../../README.md) for setup and the full endpoint list.
