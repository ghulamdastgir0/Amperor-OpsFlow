-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_ROLE_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'NOTED';

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "routed_role_id" UUID;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_routed_role_id_fkey" FOREIGN KEY ("routed_role_id") REFERENCES "employee_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
