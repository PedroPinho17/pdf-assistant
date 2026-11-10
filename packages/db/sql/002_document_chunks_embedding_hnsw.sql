-- Approximate nearest-neighbour index for semantic search.
-- vector_cosine_ops matches the `<=>` (cosine distance) operator used by the API.
-- m / ef_construction are pgvector's defaults, written out for clarity.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
