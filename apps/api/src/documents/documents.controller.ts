import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,  
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import type { Response } from 'express';

type UploadedPdf = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
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
  async upload(@UploadedFile() file?: UploadedPdf) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const document = await this.documentsService.upload(file);
    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      storageKey: document.storageKey,
      createdAt: document.createdAt,
      
    };
  }

  @Get()
  async findAll() {
    const documents = await this.documentsService.findAll();
    return documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      status: d.status,
      createdAt: d.createdAt,
    }));
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const document = await this.documentsService.findOne(id);
    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      createdAt: document.createdAt,
    };
  }

  @Get(':id/file')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { path, filename } = await this.documentsService.getFilePath(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.sendFile(path, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('File not found');
      }
    });
  }

  @Get(':id/search')
  async search(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q?: string,
  ) {
    if (!q?.trim()) {
      throw new BadRequestException('q is required');
    }
    const results = await this.documentsService.search(id, q.trim());
    return results.map((r) => ({
      page: r.page,
      score: r.score,
      content: r.content.slice(0, 200),
    }));
  }
  @Post(':id/chat')
  async chat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { question?: string; locale?: string },
  ) {
    if (!body?.question?.trim()) {
      throw new BadRequestException('question is required');
    }
    return this.documentsService.chat(id, body.question.trim(), body.locale);
  }
  
  @Post(':id/chat/stream')
  async chatStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { question?: string; locale?: string },
    @Res() res: Response,
  ) {
    if (!body?.question?.trim()) {
      throw new BadRequestException('question is required');
    }
    await this.documentsService.chatStream(
      id,
      body.question.trim(),
      res,
      body.locale,
    );
  }
}
