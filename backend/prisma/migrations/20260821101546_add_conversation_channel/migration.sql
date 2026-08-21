-- DropIndex
DROP INDEX "conversations_tenant_id_user_id_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel" "RequestChannel" NOT NULL DEFAULT 'assistant_ui';

-- CreateIndex
CREATE INDEX "conversations_tenant_id_user_id_channel_idx" ON "conversations"("tenant_id", "user_id", "channel");
