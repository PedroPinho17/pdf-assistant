import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity.js';

export type ChatSource = {
  n: number;
  page: number | null;
  excerpt: string;
};

/** One question/answer exchange about a document. */
@Entity({ name: 'chat_messages' })
@Index(['documentId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document, (doc) => doc.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  sources!: ChatSource[];

  @CreateDateColumn()
  createdAt!: Date;
}
