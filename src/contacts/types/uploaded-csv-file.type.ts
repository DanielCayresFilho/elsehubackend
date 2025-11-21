import type { Express } from 'express';

export type UploadedCsvFile = Pick<
  Express.Multer.File,
  'mimetype' | 'buffer' | 'originalname' | 'size'
>;
