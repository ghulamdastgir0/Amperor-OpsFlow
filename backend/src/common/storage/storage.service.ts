import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import type { Response } from 'express';

// Thin wrapper around the GCS client. Uses Application Default Credentials —
// no key file: Cloud Run's attached service account provides ADC
// automatically, and local dev picks it up after a one-time
// `gcloud auth application-default login`. Same bucket, same code path in
// every environment (see plan: "GCS everywhere").
@Injectable()
export class StorageService {
  private readonly client = new Storage();
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>('storage.bucket');
    if (!bucket) {
      throw new Error('Missing required config: storage.bucket (GCS_BUCKET_NAME)');
    }
    this.bucketName = bucket;
  }

  async upload(buffer: Buffer, objectPath: string, contentType?: string): Promise<void> {
    try {
      await this.client
        .bucket(this.bucketName)
        .file(objectPath)
        .save(buffer, { contentType, resumable: false });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload ${objectPath} to storage: ${(error as Error).message}`,
      );
    }
  }

  // Pipes the object straight into the HTTP response instead of buffering it
  // fully in memory — the caller is responsible for setting
  // Content-Type/Content-Disposition before calling this.
  streamTo(objectPath: string, res: Response): void {
    const file = this.client.bucket(this.bucketName).file(objectPath);
    const stream = file.createReadStream();
    stream.on('error', (error: { code?: number }) => {
      if (!res.headersSent) {
        if (error.code === 404) {
          res.status(404).json({ message: 'File not found' });
        } else {
          res.status(500).json({ message: 'Failed to read file from storage' });
        }
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}
