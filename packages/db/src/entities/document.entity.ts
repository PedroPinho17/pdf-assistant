import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentChunk } from './document-chunk.entity.js';
import { ChatMessage } from './chat-message.entity.js';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar', nullable: true })
  storageKey!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.document)
  chunks!: DocumentChunk[];

  @OneToMany(() => ChatMessage, (message) => message.document)
  messages!: ChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
