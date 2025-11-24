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
  relativeToBasePath: string;
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
    const subdirectory = this.sanitizeSubdirectory(options.subdirectory);
    const targetDir = path.join(this.basePath, subdirectory);
    await this.ensureDirectory(targetDir);

    const filename = this.generateFilename(options.originalName);
    const absolutePath = path.join(targetDir, filename);
    const relativePath = path.relative(process.cwd(), absolutePath);
    const relativeToBasePath = this.toPosixPath(
      path.relative(this.basePath, absolutePath),
    );

    await fs.writeFile(absolutePath, options.buffer);
    this.logger.debug(`Arquivo salvo em ${absolutePath}`);

    return {
      filename,
      relativePath,
      relativeToBasePath,
      absolutePath,
      size: options.buffer.length,
    };
  }

  resolveRelativePath(relativePath: string): string {
    const sanitized = this.sanitizeRelativePath(relativePath);
    return path.join(this.basePath, sanitized);
  }

  toPublicPath(relativePath: string): string {
    return this.toPosixPath(this.sanitizeRelativePath(relativePath));
  }

  async deleteFile(relativePath: string): Promise<void> {
    if (!relativePath) {
      return;
    }
    const targetPath = this.resolveRelativePath(relativePath);
    try {
      await fs.rm(targetPath, { force: true });
      this.logger.debug(`Arquivo removido: ${targetPath}`);
    } catch (error: any) {
      this.logger.warn(`Falha ao remover arquivo ${targetPath}: ${error.message}`);
    }
  }

  private async ensureDirectory(directoryPath: string) {
    await fs.mkdir(directoryPath, { recursive: true });
  }

  private sanitizeSubdirectory(subdirectory?: string) {
    if (!subdirectory) {
      return '';
    }

    return subdirectory
      .split(/[/\\]+/)
      .filter((segment) => segment && segment !== '..')
      .join(path.sep);
  }

  private sanitizeRelativePath(relativePath: string) {
    return relativePath
      .split(/[/\\]+/)
      .filter((segment) => segment && segment !== '..')
      .join(path.sep);
  }

  private toPosixPath(filePath: string) {
    return filePath.split(path.sep).join('/');
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
