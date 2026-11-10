import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity.js';

/*
 * GIN (full-text) and HNSW (vector) indexes need operator classes TypeORM
 * cannot express, so they are created in packages/db/sql/*.sql.
 * `synchronize: false` declares them here so schema sync never drops them.
 */
@Entity({ name: 'document_chunks' })
@Index('document_chunks_tsv_gin', { synchronize: false })
@Index('document_chunks_embedding_hnsw', { synchronize: false })
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Every search filters by document, and ON DELETE CASCADE looks chunks up by it.
  @Index('document_chunks_document_id_idx')
  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document, (doc) => doc.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'vector' as any,
    length: 384,
    nullable: true,
    transformer: {
      to: (value?: number[] | null) =>
        value == null ? null : `[${value.join(',')}]`,
      from: (value?: string | null) =>
        value == null
          ? null
          : value
              .replace(/^\[|\]$/g, '')
              .split(',')
              .map(Number),
    },
  })
  embedding!: number[] | null;

  @Column({ type: 'int', nullable: true })
  page!: number | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({
    type: 'tsvector',
    generatedType: 'STORED',
    asExpression: `to_tsvector('portuguese', content)`,
    select: false,
    nullable: true,
  })
  tsv?: string;
}