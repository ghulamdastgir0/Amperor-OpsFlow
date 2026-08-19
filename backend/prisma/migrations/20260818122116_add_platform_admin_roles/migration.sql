-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_global_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;
