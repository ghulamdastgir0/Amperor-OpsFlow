-- CreateTable
CREATE TABLE "policy_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_document_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_chunks_tenant_id_idx" ON "policy_chunks"("tenant_id");

-- AddForeignKey
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_policy_document_id_fkey" FOREIGN KEY ("policy_document_id") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
