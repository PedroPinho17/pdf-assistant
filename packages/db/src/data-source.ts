import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Document } from './entities/document.entity.js';
import { DocumentChunk } from './entities/document-chunk.entity.js';
import { ChatMessage } from './entities/chat-message.entity.js';

const root = resolve(__dirname, '../../..');
try {
  loadEnvFile(resolve(root, '.env'));
} catch {
  // Root .env is optional when DATABASE_URL is already set in the environment.
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Document, DocumentChunk, ChatMessage],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;
