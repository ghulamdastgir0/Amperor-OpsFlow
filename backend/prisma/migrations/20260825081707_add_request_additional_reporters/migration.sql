-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "additional_reporters" JSONB NOT NULL DEFAULT '[]';
