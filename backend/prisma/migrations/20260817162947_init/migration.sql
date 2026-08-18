-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "slack_bot_token" TEXT,
ADD COLUMN     "slack_bot_user_id" TEXT,
ADD COLUMN     "slack_query_channel_id" TEXT;
