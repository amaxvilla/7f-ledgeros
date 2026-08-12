-- Release IA: Core Integration Framework — additive. One new table,
-- integration_providers, with no changes to any existing table.

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('STORAGE', 'EMAIL', 'SMS', 'WHATSAPP', 'PAYMENT', 'BANKING', 'MICROSOFT_GRAPH', 'GOOGLE_WORKSPACE', 'DIGITAL_SIGNATURE', 'POWER_BI', 'API_GATEWAY', 'OTHER');
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEGRADED', 'ERROR');

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT,
    "category" "IntegrationCategory" NOT NULL,
    "providerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'INACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "encryptedCredentials" TEXT,
    "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 2000,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckOk" BOOLEAN,
    "lastHealthCheckError" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_providers_category_providerCode_entityId_key" ON "integration_providers"("category", "providerCode", "entityId");
CREATE INDEX "integration_providers_entityId_status_idx" ON "integration_providers"("entityId", "status");
CREATE INDEX "integration_providers_category_idx" ON "integration_providers"("category");

-- AddForeignKey
ALTER TABLE "integration_providers" ADD CONSTRAINT "integration_providers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_providers" ADD CONSTRAINT "integration_providers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
