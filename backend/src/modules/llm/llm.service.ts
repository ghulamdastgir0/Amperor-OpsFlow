import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface LlmContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface LlmContent {
  role: 'user' | 'model';
  parts: LlmContentPart[];
}

interface GenerateContentParams {
  systemInstruction?: string;
  contents: LlmContent[];
  jsonResponse?: boolean;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

interface EmbedContentResponse {
  embedding?: { values?: number[] };
}

// Thrown on any failure talking to the LLM provider — callers decide their own
// graceful-degradation fallback (canned reply, empty citations, empty OCR result).
export class LlmRequestError extends Error {}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async generateContent(params: GenerateContentParams): Promise<string> {
    const model = this.config.get<string>('llm.model');
    const apiKey = this.requireApiKey();

    const body: Record<string, unknown> = {
      contents: params.contents,
    };
    if (params.systemInstruction) {
      body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
    }
    if (params.jsonResponse) {
      body.generationConfig = { responseMimeType: 'application/json' };
    }

    const data = await this.post<GenerateContentResponse>(
      `${API_BASE}/${model}:generateContent`,
      apiKey,
      body,
    );

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new LlmRequestError('LLM returned no content');
    }
    return text;
  }

  async generateJson<T>(params: GenerateContentParams): Promise<T> {
    const text = await this.generateContent({ ...params, jsonResponse: true });
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.warn(
        `Failed to parse LLM JSON response: ${text.slice(0, 200)}`,
      );
      throw new LlmRequestError('LLM returned invalid JSON');
    }
  }

  async generateVisionContent(input: {
    mimeType: string;
    dataBase64: string;
    prompt: string;
    jsonResponse?: boolean;
  }): Promise<string> {
    return this.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: input.prompt },
            {
              inlineData: { mimeType: input.mimeType, data: input.dataBase64 },
            },
          ],
        },
      ],
      jsonResponse: input.jsonResponse,
    });
  }

  async embedContent(text: string): Promise<number[]> {
    const model = this.config.get<string>('llm.embeddingModel');
    const apiKey = this.requireApiKey();

    const data = await this.post<EmbedContentResponse>(
      `${API_BASE}/${model}:embedContent`,
      apiKey,
      { content: { parts: [{ text }] } },
    );

    const values = data.embedding?.values;
    if (!values || values.length === 0) {
      throw new LlmRequestError('LLM returned no embedding');
    }
    return values;
  }

  private async post<T>(
    url: string,
    apiKey: string,
    body: unknown,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(url, body, {
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `LLM request failed: ${axiosError.response?.status ?? ''} ${JSON.stringify(
          axiosError.response?.data ?? axiosError.message,
        )}`,
      );
      throw new LlmRequestError('LLM request failed');
    }
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>('llm.apiKey');
    if (!apiKey)
      throw new LlmRequestError('Missing required config: llm.apiKey');
    return apiKey;
  }
}
