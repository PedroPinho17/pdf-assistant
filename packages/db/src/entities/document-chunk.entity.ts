import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity.js';

@Entity({ name: 'document_chunks' })
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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