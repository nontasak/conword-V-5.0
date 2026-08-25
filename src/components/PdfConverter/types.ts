export interface ProcessedPage {
  pageNumber: number;
  imageUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export enum ConversionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface PDFMetadata {
  name: string;
  pageCount: number;
  size: number;
}
