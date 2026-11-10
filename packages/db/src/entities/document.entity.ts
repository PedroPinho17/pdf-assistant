import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentChunk } from './document-chunk.entity.js';
import { ChatMessage } from './chat-message.entity.js';
import { User } from './user.entity.js';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Owner. Nullable only so documents created before accounts existed keep
   * loading; documents without an owner are not visible to anyone.
   */
  @Index('documents_user_id_idx')
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

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
