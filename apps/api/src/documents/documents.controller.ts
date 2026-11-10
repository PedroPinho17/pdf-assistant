import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators';
import { DocumentsService } from './documents.service';

type UploadedPdf = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type ChatBody = { question?: unknown; locale?: unknown };

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_QUESTION_LENGTH = 1000;

// Per-IP limits for the expensive routes (LLM calls, embeddings, disk).
const UPLOAD_LIMIT = { default: { limit: 10, ttl: 60_000 } };
const CHAT_LIMIT = { default: { limit: 15, ttl: 60_000 } };
const SEARCH_LIMIT = { default: { limit: 30, ttl: 60_000 } };

/** Every real PDF starts with the "%PDF-" signature. */
function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

function parseQuestion(body: ChatBody): { question: string; locale?: string } {
  const question =
    typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) {
    throw new BadRequestException('question is required');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new BadRequestException(
      `question must be at most ${MAX_QUESTION_LENGTH} characters`,
    );
  }
  const locale =
    body.locale === 'pt' || body.locale === 'en' ? body.locale : undefined;
  return { question, locale };
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @Throttle(UPLOAD_LIMIT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        // Cheap early rejection; the real check is the file signature below.
        if (
          file.mimetype !== 'application/pdf' &&
          !file.originalname.toLowerCase().endsWith('.pdf')
        ) {
          cb(new BadRequestException('Only PDF files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedPdf,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    // MIME type and extension come from the client and can be faked.
    if (!isPdfBuffer(file.buffer)) {
      throw new BadRequestException('Only PDF files are allowed');
    }
    const document = await this.documentsService.upload(file, user.id);
    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      createdAt: document.createdAt,
    };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const documents = await this.documentsService.findAll(user.id);
    return documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      status: d.status,
      createdAt: d.createdAt,
    }));
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const document = await this.documentsService.findOne(id, user.id);
    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      createdAt: document.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.documentsService.remove(id, user.id);
  }

  @Get(':id/messages')
  async messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.listMessages(id, user.id);
  }

  @Delete(':id/messages')
  @HttpCode(204)
  async clearMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.documentsService.clearMessages(id, user.id);
  }

  @Get(':id/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { path, filename } = await this.documentsService.getFilePath(
      id,
      user.id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    // Private, per-user content: never store in shared caches.
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('File not found');
      }
    });
  }

  @Get(':id/search')
  @Throttle(SEARCH_LIMIT)
  async search(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q?: string,
  ) {
    const { question } = parseQuestion({ question: q });
    const results = await this.documentsService.search(id, question, user.id);
    return results.map((r) => ({
      page: r.page,
      score: r.score,
      content: r.content.slice(0, 200),
    }));
  }

  @Post(':id/chat')
  @Throttle(CHAT_LIMIT)
  async chat(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChatBody,
  ) {
    const { question, locale } = parseQuestion(body);
    return this.documentsService.chat(id, question, user.id, locale);
  }

  @Post(':id/chat/stream')
  @Throttle(CHAT_LIMIT)
  async chatStream(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChatBody,
    @Res() res: Response,
  ) {
    const { question, locale } = parseQuestion(body);
    await this.documentsService.chatStream(id, question, user.id, res, locale);
  }
}
