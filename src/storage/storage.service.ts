import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';

export type SaveFileOptions = {
  buffer: Buffer;
  originalName: string;
  subdirectory?: string;
};

export type SavedFileMetadata = {
  filename: string;
  relativePath: string;
  absolutePath: string;
  size: number;
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath =
      this.configService.get<string>('storage.basePath') ?? './storage';
    this.basePath = path.resolve(process.cwd(), configuredPath);
  }

  async onModuleInit() {
    await this.ensureBasePathExists();
  }

  async ensureBasePathExists() {
    await this.ensureDirectory(this.basePath);
  }

  async saveFile(options: SaveFileOptions): Promise<SavedFileMetadata> {
    const subdirectory = options.subdirectory
      ? options.subdirectory.replace(/^\/+/, '')
      : '';
    const targetDir = path.join(this.basePath, subdirectory);
    await this.ensureDirectory(targetDir);

    const filename = this.generateFilename(options.originalName);
    const absolutePath = path.join(targetDir, filename);
    const relativePath = path.relative(process.cwd(), absolutePath);

    await fs.writeFile(absolutePath, options.buffer);
    this.logger.debug(`Arquivo salvo em ${absolutePath}`);

    return {
      filename,
      relativePath,
      absolutePath,
      size: options.buffer.length,
    };
  }

  private async ensureDirectory(directoryPath: string) {
    await fs.mkdir(directoryPath, { recursive: true });
  }

  private generateFilename(originalName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(originalName || 'file');
    const safeName =
      parsed.name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'file';
    const extension = parsed.ext || '.csv';

    return `${timestamp}-${safeName}${extension}`;
  }
}
