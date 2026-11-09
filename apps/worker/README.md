# Worker

Background worker for PDF Assistant that consumes the `ingest` queue (BullMQ).

For each uploaded document it:

1. Extracts text page by page (unpdf)
2. Splits each page into overlapping, word-aligned chunks
3. Generates 384-dimension embeddings locally (`Xenova/multilingual-e5-small`)
4. Stores chunks and vectors in PostgreSQL (pgvector) and marks the document as `processed`

```bash
pnpm --filter worker dev
```

See the [root README](../../README.md) for the full setup.
