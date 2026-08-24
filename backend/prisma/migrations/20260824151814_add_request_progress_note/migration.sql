-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "progress_note" TEXT,
ADD COLUMN     "progress_note_at" TIMESTAMPTZ;
