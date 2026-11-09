ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED;

CREATE INDEX IF NOT EXISTS document_chunks_tsv_gin
  ON document_chunks
  USING GIN (tsv);