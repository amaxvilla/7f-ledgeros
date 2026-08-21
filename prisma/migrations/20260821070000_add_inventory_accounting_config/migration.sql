CREATE TABLE "inventory_accounting_configs" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "inventoryAssetAccountId" TEXT NOT NULL,
    "grniAccountId" TEXT NOT NULL,
    "cogsAccountId" TEXT NOT NULL,
    "inventoryGainAccountId" TEXT NOT NULL,
    "inventoryLossAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_accounting_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_accounting_configs_entityId_key"
    ON "inventory_accounting_configs"("entityId");

CREATE INDEX "inventory_accounting_configs_entityId_isActive_idx"
    ON "inventory_accounting_configs"("entityId", "isActive");

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_entityId_fkey"
    FOREIGN KEY ("entityId")
    REFERENCES "entities"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_inventoryAssetAccountId_fkey"
    FOREIGN KEY ("inventoryAssetAccountId")
    REFERENCES "accounts"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_grniAccountId_fkey"
    FOREIGN KEY ("grniAccountId")
    REFERENCES "accounts"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_cogsAccountId_fkey"
    FOREIGN KEY ("cogsAccountId")
    REFERENCES "accounts"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_inventoryGainAccountId_fkey"
    FOREIGN KEY ("inventoryGainAccountId")
    REFERENCES "accounts"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "inventory_accounting_configs"
    ADD CONSTRAINT "inventory_accounting_configs_inventoryLossAccountId_fkey"
    FOREIGN KEY ("inventoryLossAccountId")
    REFERENCES "accounts"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;