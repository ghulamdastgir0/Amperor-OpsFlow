// One-off migration: uploads any Attachment.fileData bytes (from before the
// move to GCS-backed storage) into the bucket and sets storagePath. Safe to
// re-run — only touches rows where storagePath is still null.
//   npm run backfill:attachment-storage
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';

async function main() {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    console.error('Missing GCS_BUCKET_NAME env var.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const storage = new Storage();
  try {
    const attachments = await prisma.attachment.findMany({
      where: { fileData: { not: null }, storagePath: null },
      select: {
        id: true,
        requestId: true,
        fileName: true,
        mimeType: true,
        fileData: true,
        request: { select: { tenantId: true } },
      },
    });

    console.log(`Found ${attachments.length} attachment(s) to backfill.`);
    for (const attachment of attachments) {
      // Same convention as RequestsService.attachProof/SlackService.ingestFile.
      const objectPath = `attachments/${attachment.request.tenantId}/${attachment.requestId}/${attachment.id}-${attachment.fileName ?? 'file'}`;
      await storage
        .bucket(bucketName)
        .file(objectPath)
        .save(Buffer.from(attachment.fileData!), {
          contentType: attachment.mimeType ?? undefined,
          resumable: false,
        });
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { storagePath: objectPath },
      });
      console.log(`Backfilled ${attachment.id} -> ${objectPath}`);
    }
    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
