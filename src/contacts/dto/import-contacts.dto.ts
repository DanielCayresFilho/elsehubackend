export class ImportContactsRowErrorDto {
  rowNumber: number;
  phone?: string;
  reason: string;
}

export class ImportContactsResultDto {
  totalRows: number;
  processedRows: number;
  created: number;
  skipped: number;
  storedFilePath: string;
  storedFileName: string;
  storedFileSize: number;
  errors: ImportContactsRowErrorDto[];
}
