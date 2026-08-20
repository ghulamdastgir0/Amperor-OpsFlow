-- CreateTable
CREATE TABLE "employee_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_employee_roles" (
    "user_id" UUID NOT NULL,
    "employee_role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_employee_roles_pkey" PRIMARY KEY ("user_id","employee_role_id")
);

-- CreateTable
CREATE TABLE "role_broadcasts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "forwarded_to_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_broadcast_targets" (
    "broadcast_id" UUID NOT NULL,
    "employee_role_id" UUID NOT NULL,

    CONSTRAINT "role_broadcast_targets_pkey" PRIMARY KEY ("broadcast_id","employee_role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_roles_tenant_id_name_key" ON "employee_roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "role_broadcasts_tenant_id_idx" ON "role_broadcasts"("tenant_id");

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_employee_roles" ADD CONSTRAINT "user_employee_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_employee_roles" ADD CONSTRAINT "user_employee_roles_employee_role_id_fkey" FOREIGN KEY ("employee_role_id") REFERENCES "employee_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_broadcasts" ADD CONSTRAINT "role_broadcasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_broadcasts" ADD CONSTRAINT "role_broadcasts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_broadcast_targets" ADD CONSTRAINT "role_broadcast_targets_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "role_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_broadcast_targets" ADD CONSTRAINT "role_broadcast_targets_employee_role_id_fkey" FOREIGN KEY ("employee_role_id") REFERENCES "employee_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
