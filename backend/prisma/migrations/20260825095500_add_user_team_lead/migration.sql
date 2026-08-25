-- AlterTable
ALTER TABLE "users" ADD COLUMN     "team_lead_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_lead_id_fkey" FOREIGN KEY ("team_lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
