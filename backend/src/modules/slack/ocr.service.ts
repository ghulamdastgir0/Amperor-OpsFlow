import { Injectable } from '@nestjs/common';

export interface ParsedDocumentFields {
  merchantName?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{ description: string; amount: number }>;
  taxId?: string;
  documentDate?: string;
  rawText: string;
}

// Multimodal & OCR Parsing step of the ingestion pipeline (SRS Section 5.1, step 4).
// Wire this up to the chosen OCR/Vision LLM provider.
@Injectable()
export class OcrService {
  extractFields(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<ParsedDocumentFields> {
    void fileBuffer;
    void mimeType;
    return Promise.resolve({ rawText: '' });
  }
}
