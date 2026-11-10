import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stored lower-cased; unique per account. */
  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  /** scrypt hash in the form `scrypt$<salt hex>$<hash hex>` — never the password. */
  @Column({ type: 'varchar', select: false })
  passwordHash!: string;

  @OneToMany(() => Document, (doc) => doc.user)
  documents!: Document[];

  @CreateDateColumn()
  createdAt!: Date;
}
