import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

export interface ParsedDocumentFields {
  merchantName?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{ description: string; amount: number }>;
  taxId?: string;
  documentDate?: string;
  rawText: string;
}

const EXTRACTION_PROMPT = `You are extracting structured data from a receipt or invoice image for an
expense reimbursement system. Respond with ONLY a JSON object matching this exact shape (omit a field
if it's not present on the document, but always include rawText):
{
  "merchantName": string,
  "totalAmount": number,
  "currency": string (ISO 4217 code, e.g. "USD"),
  "lineItems": [{ "description": string, "amount": number }],
  "taxId": string,
  "documentDate": string (YYYY-MM-DD),
  "rawText": string (all text visible on the document)
}`;

// Multimodal & OCR Parsing step of the ingestion pipeline (SRS Section 5.1, step 4).
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly llm: LlmService) {}

  async extractFields(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<ParsedDocumentFields> {
    try {
      const result = await this.llm.generateJson<Partial<ParsedDocumentFields>>(
        {
          systemInstruction: EXTRACTION_PROMPT,
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Extract the fields from this document.' },
                {
                  inlineData: {
                    mimeType,
                    data: fileBuffer.toString('base64'),
                  },
                },
              ],
            },
          ],
        },
      );
      return { ...result, rawText: result.rawText ?? '' };
    } catch (error) {
      this.logger.warn(`OCR extraction failed: ${(error as Error).message}`);
      return { rawText: '' };
    }
  }
}
