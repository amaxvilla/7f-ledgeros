-- Release P: IP Restrictions — additive. One new table, no existing
-- columns touched.

-- CreateEnum
CREATE TYPE "IpRuleScope" AS ENUM ('GLOBAL', 'USER');

-- CreateTable
CREATE TABLE "ip_allowlist_rules" (
    "id" TEXT NOT NULL,
    "scope" "IpRuleScope" NOT NULL,
    "userId" TEXT,
    "cidr" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_allowlist_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ip_allowlist_rules_scope_isActive_idx" ON "ip_allowlist_rules"("scope", "isActive");
CREATE INDEX "ip_allowlist_rules_userId_idx" ON "ip_allowlist_rules"("userId");

-- AddForeignKey
ALTER TABLE "ip_allowlist_rules" ADD CONSTRAINT "ip_allowlist_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ip_allowlist_rules" ADD CONSTRAINT "ip_allowlist_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
