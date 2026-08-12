-- Agent & Commission Management, RE-COMM.3: Commission Lifecycle.
-- Additive only: no existing column/table dropped or altered in place.
-- Extends CommissionCalculationStatus and CommissionCalculation
-- (RE-COMM.2) with the forward approval/payment workflow plus
-- adjustment linkage. Assumes "commission_calculations" and "users"
-- already exist (RE-COMM.2).

-- AlterEnum: add the new lifecycle states. Postgres requires each new
-- enum value added outside a transaction block in older versions; the
-- ALTER TYPE ... ADD VALUE form used here is safe to run inside the
-- same migration transaction on Postgres 12+, matching how prior
-- checkpoints in this project have extended enums additively.
ALTER TYPE "CommissionCalculationStatus" ADD VALUE 'PENDING';
ALTER TYPE "CommissionCalculationStatus" ADD VALUE 'APPROVED';
ALTER TYPE "CommissionCalculationStatus" ADD VALUE 'PAYABLE';
ALTER TYPE "CommissionCalculationStatus" ADD VALUE 'PAID';
ALTER TYPE "CommissionCalculationStatus" ADD VALUE 'REJECTED';

-- AlterTable: forward lifecycle audit columns.
ALTER TABLE "commission_calculations" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "commission_calculations" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "commission_calculations" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "commission_calculations" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "markedPayableById" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "markedPayableAt" TIMESTAMP(3);
ALTER TABLE "commission_calculations" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "paidById" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "commission_calculations" ADD COLUMN "supersedesCalculationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "commission_calculations_supersedesCalculationId_key" ON "commission_calculations"("supersedesCalculationId");

-- AddForeignKey
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_markedPayableById_fkey" FOREIGN KEY ("markedPayableById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_supersedesCalculationId_fkey" FOREIGN KEY ("supersedesCalculationId") REFERENCES "commission_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
