-- Foundational schema migration
-- Repairs the missing base of the Prisma migration chain.
-- Generated from baseline_full.sql, EXCLUDING every table, enum,
-- index, constraint, and column that is already created by one of
-- the 58 pre-existing migrations (20260726130000_phase2_rls_access_grants
-- onward). See MIGRATION_REPAIR_REPORT.md for the full audit.

-- =========================================================
-- ENUMS
-- =========================================================
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('CURRENT_ASSET', 'NON_CURRENT_ASSET', 'CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY', 'SHARE_CAPITAL', 'RETAINED_EARNINGS', 'OTHER_EQUITY', 'OPERATING_REVENUE', 'OTHER_REVENUE', 'COST_OF_SALES', 'OPERATING_EXPENSE', 'FINANCE_EXPENSE', 'TAX_EXPENSE');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'PAYROLL', 'REVENUE_RECOGNITION', 'INTERCOMPANY', 'BANK_IMPORT', 'SYSTEM_REVERSAL', 'CONSOLIDATION', 'PROCUREMENT', 'ACCOUNTS_PAYABLE', 'ACCOUNTS_RECEIVABLE', 'FIXED_ASSET');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "EntityRelationshipType" AS ENUM ('SUBSIDIARY', 'JOINT_VENTURE', 'ASSOCIATE', 'BRANCH');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ALLOCATED', 'UNDER_CONTRACT', 'HANDED_OVER', 'SOLD');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'PARTIALLY_RECONCILED', 'RECONCILED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "InventoryDomain" AS ENUM ('CONSTRUCTION_MATERIALS', 'TOOLS_EQUIPMENT', 'HSE_SUPPLIES', 'OFFICE_SUPPLIES', 'PROPERTY_INVENTORY');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'COUNT_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryDocStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'FATAL');

-- CreateEnum
CREATE TYPE "HseCaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'PASS_WITH_OBSERVATIONS', 'FAIL');

-- CreateEnum
CREATE TYPE "PmoDocStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'CERTIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'MATURED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MaturityInstruction" AS ENUM ('ROLLOVER_PRINCIPAL', 'ROLLOVER_PRINCIPAL_AND_INTEREST', 'PAYOUT');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BudgetRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BudgetTransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BudgetApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'FROZEN', 'REVISED', 'TRANSFERRED', 'REOPENED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BudgetCommitmentSourceType" AS ENUM ('PURCHASE_ORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "BudgetCommitmentStatus" AS ENUM ('OPEN', 'PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcurementGRNStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorInvoiceStatus" AS ENUM ('DRAFT', 'PENDING_MATCH', 'MATCHED', 'MATCHED_WITH_VARIANCE', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ThreeWayMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'MATCHED_WITH_VARIANCE', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentVoucherStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentBatchStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorLedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TaxRemittanceStatus" AS ENUM ('PENDING', 'REMITTED');

-- CreateEnum
CREATE TYPE "ARInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerLedgerEntryType" AS ENUM ('INVOICE', 'RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReconciliationSessionStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ReconciliationMatchType" AS ENUM ('AUTO', 'MANUAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WorkflowStageType" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVAL', 'POSTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'RETURNED', 'POSTED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowStageInstanceStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 'RETURNED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowActionType" AS ENUM ('SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'POST', 'ARCHIVE', 'COMMENT');

-- CreateEnum
CREATE TYPE "WorkflowRuleField" AS ENUM ('AMOUNT', 'DEPARTMENT', 'PROJECT', 'ENTITY', 'ROLE', 'RISK_LEVEL', 'BUDGET_AVAILABILITY');

-- CreateEnum
CREATE TYPE "WorkflowRuleOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ', 'IN');

-- CreateEnum
CREATE TYPE "BrandAssetType" AS ENUM ('LOGO', 'LETTERHEAD', 'WATERMARK', 'DIGITAL_SIGNATURE', 'STAMP');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('EMAIL', 'INVOICE', 'PURCHASE_ORDER', 'RECEIPT');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CurrencySymbolPosition" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATION', 'CONFIRMED', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetAssignmentStatus" AS ENUM ('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'BIOMETRIC', 'MOBILE');

-- CreateEnum
CREATE TYPE "BiometricEventType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "DisciplinaryCaseType" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION', 'TERMINATION_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "DisciplinaryCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLOSED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ExitType" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT');

-- CreateEnum
CREATE TYPE "ExitClearanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExitClearanceItemStatus" AS ENUM ('PENDING', 'CLEARED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('STRONG_YES', 'YES', 'NEUTRAL', 'NO', 'STRONG_NO');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CLEARED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('TRANSFER', 'PROMOTION', 'DEMOTION', 'SECONDMENT', 'CONTRACT_RENEWAL', 'CONFIRMATION');

-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('OPEN', 'CALIBRATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SELF_ASSESSMENT', 'MANAGER_REVIEW', 'PEER_REVIEW', 'CALIBRATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('ENROLLED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SuccessionReadiness" AS ENUM ('READY_NOW', 'READY_1_2_YEARS', 'READY_3_5_YEARS', 'DEVELOPING');

-- CreateEnum
CREATE TYPE "SuccessionCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ', 'DELIVERED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED');

-- =========================================================
-- TABLES
-- =========================================================
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "user_entity_access" (
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "canView" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_entity_access_pkey" PRIMARY KEY ("userId","entityId")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxIdentificationNumber" TEXT,
    "registrationNumber" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConsolidationParent" BOOLEAN NOT NULL DEFAULT false,
    "parentEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relationships" (
    "id" TEXT NOT NULL,
    "parentEntityId" TEXT NOT NULL,
    "childEntityId" TEXT NOT NULL,
    "relationshipType" "EntityRelationshipType" NOT NULL,
    "ownershipPercent" DECIMAL(6,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "accountCategory" "AccountCategory" NOT NULL,
    "ifrsMapping" TEXT,
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "parentAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_accounts" (
    "entityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "entity_accounts_pkey" PRIMARY KEY ("entityId","accountId")
);

-- CreateTable
CREATE TABLE "estates" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "estateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "unitType" TEXT,
    "sizeSqm" DECIMAL(10,2),
    "listPrice" DECIMAL(18,2) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_sources" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "funding_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_number_sequences" (
    "entityId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "journal_number_sequences_pkey" PRIMARY KEY ("entityId","fiscalYear")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "journalNumber" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceReference" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "reversalOfId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "blockId" TEXT,
    "floorId" TEXT,
    "unitId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "fundingSourceId" TEXT,
    "vendorId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intercompany_transactions" (
    "id" TEXT NOT NULL,
    "initiatorEntityId" TEXT NOT NULL,
    "counterpartyEntityId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "mirrorJournalEntryId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "description" TEXT NOT NULL,
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intercompany_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intercompany_eliminations" (
    "id" TEXT NOT NULL,
    "intercompanyTransactionId" TEXT NOT NULL,
    "consolidationGroupId" TEXT NOT NULL,
    "eliminationAmount" DECIMAL(18,2) NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intercompany_eliminations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidation_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentEntityId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consolidation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidation_ownerships" (
    "id" TEXT NOT NULL,
    "consolidationGroupId" TEXT NOT NULL,
    "parentEntityId" TEXT NOT NULL,
    "childEntityId" TEXT NOT NULL,
    "ownershipPercent" DECIMAL(6,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "consolidation_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_sale_allocations" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salePrice" DECIMAL(18,2) NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_sale_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_schedules" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_lines" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "installment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" "InventoryDomain" NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "stockItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "averageUnitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("stockItemId","warehouseId")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "vendorId" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "status" "InventoryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_issues" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT,
    "status" "InventoryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_issue_lines" (
    "id" TEXT NOT NULL,
    "materialIssueId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "material_issue_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "status" "InventoryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL,
    "status" "InventoryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "countedQuantity" DECIMAL(18,4) NOT NULL,
    "systemQuantity" DECIMAL(18,4) NOT NULL,
    "varianceQuantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "housingAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "salaryStructureId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoUrl" TEXT,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "maritalStatus" "MaritalStatus",
    "nationality" TEXT,
    "stateOfOrigin" TEXT,
    "phone" TEXT,
    "personalEmail" TEXT,
    "workEmail" TEXT,
    "residentialAddress" TEXT,
    "jobTitle" TEXT,
    "gradeLevel" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
    "hireDate" TIMESTAMP(3),
    "confirmationDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "reportsToId" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "pensionPin" TEXT,
    "taxId" TEXT,
    "userId" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payPeriodName" TEXT NOT NULL,
    "payPeriodStart" TIMESTAMP(3) NOT NULL,
    "payPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "grossPay" DECIMAL(18,2) NOT NULL,
    "payeTax" DECIMAL(18,2) NOT NULL,
    "pensionEmployee" DECIMAL(18,2) NOT NULL,
    "pensionEmployer" DECIMAL(18,2) NOT NULL,
    "nhfDeduction" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "reportedById" TEXT NOT NULL,
    "status" "HseCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "near_misses" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "status" "HseCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "near_misses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppe_issuances" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ppe_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toolbox_talks" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "topic" TEXT NOT NULL,
    "talkDate" TIMESTAMP(3) NOT NULL,
    "conductedById" TEXT NOT NULL,
    "attendeeCount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toolbox_talks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" TEXT NOT NULL,
    "incidentReportId" TEXT,
    "nearMissId" TEXT,
    "description" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklists" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "checklistType" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "result" "InspectionResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklist_items" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "isCompliant" BOOLEAN,
    "remarks" TEXT,

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "license" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boqs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "contractorId" TEXT,
    "title" TEXT NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_lines" (
    "id" TEXT NOT NULL,
    "boqId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "boq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_packages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "contractorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budgetAmount" DECIMAL(18,2) NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_valuations" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "valuationNumber" INTEGER NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL,
    "percentComplete" DECIMAL(5,2) NOT NULL,
    "valuationAmount" DECIMAL(18,2) NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interim_payment_certificates" (
    "id" TEXT NOT NULL,
    "progressValuationId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "grossValuationAmount" DECIMAL(18,2) NOT NULL,
    "retentionPercent" DECIMAL(5,2) NOT NULL,
    "retentionAmount" DECIMAL(18,2) NOT NULL,
    "previousCertifiedAmount" DECIMAL(18,2) NOT NULL,
    "netPayableAmount" DECIMAL(18,2) NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interim_payment_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_orders" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "voNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retentions" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "retentionPercent" DECIMAL(5,2) NOT NULL,
    "totalHeld" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalReleased" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_releases" (
    "id" TEXT NOT NULL,
    "retentionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_accounts" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "originalContractSum" DECIMAL(18,2) NOT NULL,
    "totalVariations" DECIMAL(18,2) NOT NULL,
    "totalCertified" DECIMAL(18,2) NOT NULL,
    "totalRetentionHeld" DECIMAL(18,2) NOT NULL,
    "finalAccountAmount" DECIMAL(18,2) NOT NULL,
    "status" "PmoDocStatus" NOT NULL DEFAULT 'DRAFT',
    "agreedDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "final_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custodian" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_facilities" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "facilityAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "interestRatePercent" DECIMAL(6,3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawdowns" (
    "id" TEXT NOT NULL,
    "loanFacilityId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "drawdownDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_lines" (
    "id" TEXT NOT NULL,
    "loanFacilityId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DECIMAL(18,2) NOT NULL,
    "interestDue" DECIMAL(18,2) NOT NULL,
    "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "repayment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_accruals" (
    "id" TEXT NOT NULL,
    "loanFacilityId" TEXT NOT NULL,
    "accrualDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_placements" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "interestRatePercent" DECIMAL(6,3) NOT NULL,
    "placementDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "maturityInstruction" "MaturityInstruction" NOT NULL DEFAULT 'PAYOUT',
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "fundingSourceId" TEXT,
    "period" INTEGER NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "revisedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_revisions" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BudgetRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_revision_lines" (
    "id" TEXT NOT NULL,
    "budgetRevisionId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "previousAmount" DECIMAL(18,2) NOT NULL,
    "newAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "budget_revision_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_transfers" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "fromLineId" TEXT NOT NULL,
    "toLineId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BudgetTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_approvals" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "action" "BudgetApprovalAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_commitments" (
    "id" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "sourceType" "BudgetCommitmentSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "releasedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "BudgetCommitmentStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "projectId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "fundingSourceId" TEXT,
    "justification" TEXT,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_lines" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "budgetLineId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "estimatedUnitCost" DECIMAL(18,2) NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "fundingSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "requisitionId" TEXT,
    "vendorId" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "requisitionLineId" TEXT,
    "description" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantityInvoiced" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "budgetLineId" TEXT NOT NULL,
    "budgetCommitmentId" TEXT,
    "projectId" TEXT,
    "phaseId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "fundingSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_grns" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "status" "ProcurementGRNStatus" NOT NULL DEFAULT 'DRAFT',
    "grIrClearingAccountId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "procurement_grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_grn_lines" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "quantityReceived" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_grn_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "VendorInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoice_lines" (
    "id" TEXT NOT NULL,
    "vendorInvoiceId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT,
    "description" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "three_way_matches" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "vendorInvoiceId" TEXT NOT NULL,
    "status" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
    "quantityVarianceQty" DECIMAL(18,4),
    "priceVarianceAmount" DECIMAL(18,2),
    "notes" TEXT,
    "matchedById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "three_way_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_ledger_entries" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "entryType" "VendorLedgerEntryType" NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_vouchers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "batchId" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "status" "PaymentVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_voucher_allocations" (
    "id" TEXT NOT NULL,
    "paymentVoucherId" TEXT NOT NULL,
    "vendorInvoiceId" TEXT NOT NULL,
    "amountAllocated" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_voucher_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wht_deductions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "paymentVoucherAllocationId" TEXT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxAuthorityAccountId" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "status" "TaxRemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "remittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wht_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_deductions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "paymentVoucherAllocationId" TEXT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxAuthorityAccountId" TEXT NOT NULL,
    "status" "TaxRemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "remittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_invoices" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "allocationId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ARInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amountReceived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "ar_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_invoice_lines" (
    "id" TEXT NOT NULL,
    "arInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ar_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_allocations" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "arInvoiceId" TEXT NOT NULL,
    "amountAllocated" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger_entries" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "entryType" "CustomerLedgerEntryType" NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_sessions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "bankGlAccountId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "status" "ReconciliationSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_matches" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "bankStatementLineId" TEXT NOT NULL,
    "journalLineId" TEXT,
    "matchType" "ReconciliationMatchType" NOT NULL,
    "matchedAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stage_definitions" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stageType" "WorkflowStageType" NOT NULL,
    "requiredRoleCode" TEXT,
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_stage_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approval_rules" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "stageDefinitionId" TEXT,
    "field" "WorkflowRuleField" NOT NULL,
    "operator" "WorkflowRuleOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "requiredRoleCode" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "context" JSONB NOT NULL,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stage_instances" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "stageDefinitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "WorkflowStageInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "requiredRoleCode" TEXT,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "approvalsReceived" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_stage_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_actions" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "WorkflowActionType" NOT NULL,
    "comments" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_branding_profiles" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F1B2D',
    "secondaryColor" TEXT NOT NULL DEFAULT '#16273D',
    "accentColor" TEXT NOT NULL DEFAULT '#C9A227',
    "themeMode" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "whiteLabelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "supportedLanguages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
    "currencySymbolPosition" "CurrencySymbolPosition" NOT NULL DEFAULT 'BEFORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_branding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_assets" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assetType" "BrandAssetType" NOT NULL,
    "label" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "templateType" "DocumentTemplateType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_profiles" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "website" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "ThemeMode",
    "language" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_entries" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_next_of_kin" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "employee_next_of_kin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_emergency_contacts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_asset_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assetTag" TEXT,
    "assetName" TEXT NOT NULL,
    "description" TEXT,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedDate" TIMESTAMP(3),
    "condition" TEXT,
    "status" "AssetAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "issuedById" TEXT NOT NULL,

    CONSTRAINT "employee_asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboarding_tasks" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,

    CONSTRAINT "employee_onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysPerYear" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DECIMAL(6,2) NOT NULL,
    "usedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carriedForwardDays" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysRequested" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_devices" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "deviceIdentifier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_event_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "rawEmployeeCode" TEXT NOT NULL,
    "eventType" "BiometricEventType" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "biometric_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_cases" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "caseType" "DisciplinaryCaseType" NOT NULL,
    "description" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DisciplinaryCaseStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "disciplinary_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_exits" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "exitType" "ExitType" NOT NULL,
    "noticeDate" TIMESTAMP(3) NOT NULL,
    "lastWorkingDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "clearanceStatus" "ExitClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "clearedAt" TIMESTAMP(3),
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_exits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_clearance_items" (
    "id" TEXT NOT NULL,
    "employeeExitId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" "ExitClearanceItemStatus" NOT NULL DEFAULT 'PENDING',
    "clearedById" TEXT,
    "clearedAt" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "exit_clearance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "projectId" TEXT,
    "requestedById" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "gradeLevel" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "justification" TEXT,
    "budgetLineId" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowInstanceId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "jobRequisitionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "VacancyStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT,
    "linkedinUrl" TEXT,
    "portalUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
    "score" DECIMAL(5,2),
    "rejectionReason" TEXT,
    "hiredEmployeeId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panelists" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "interview_panelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "recommendation" "InterviewRecommendation" NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "gradeLevel" TEXT,
    "proposedSalary" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "startDate" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowInstanceId" TEXT,
    "letterUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_checks" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" "BackgroundCheckStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "background_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_events" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "eventType" "EmploymentEventType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "fromDepartmentId" TEXT,
    "toDepartmentId" TEXT,
    "fromJobTitle" TEXT,
    "toJobTitle" TEXT,
    "fromGradeLevel" TEXT,
    "toGradeLevel" TEXT,
    "notes" TEXT,
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2),
    "targetDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT,
    "name" TEXT NOT NULL,
    "targetValue" DECIMAL(18,4) NOT NULL,
    "actualValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_assessments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "cycleId" TEXT,
    "rating" INTEGER NOT NULL,
    "assessedById" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "selfRating" DECIMAL(4,2),
    "selfComments" TEXT,
    "managerRating" DECIMAL(4,2),
    "managerComments" TEXT,
    "peerComments" TEXT,
    "calibratedRating" DECIMAL(4,2),
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "promotionRecommended" BOOLEAN NOT NULL DEFAULT false,
    "incrementRecommended" DECIMAL(5,2),
    "bonusRecommended" DECIMAL(18,2),
    "pipRequired" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_courses" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationHours" DECIMAL(6,2),
    "provider" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "cost" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cost" DECIMAL(18,2),

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_enrollments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "completionScore" DECIMAL(5,2),
    "evaluationRating" INTEGER,
    "evaluationComments" TEXT,

    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "trainingEnrollmentId" TEXT,
    "name" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "certificateUrl" TEXT,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_plans" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "incumbentEmployeeId" TEXT,
    "criticality" "SuccessionCriticality" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "succession_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_candidates" (
    "id" TEXT NOT NULL,
    "successionPlanId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readiness" "SuccessionReadiness" NOT NULL DEFAULT 'DEVELOPING',
    "isHighPotential" BOOLEAN NOT NULL DEFAULT false,
    "developmentNotes" TEXT,

    CONSTRAINT "succession_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "job_run_logs" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "attemptsMade" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_run_logs_pkey" PRIMARY KEY ("id")
);

-- =========================================================
-- INDEXES
-- =========================================================
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "entities_code_key" ON "entities"("code");

-- CreateIndex
CREATE INDEX "entities_parentEntityId_idx" ON "entities"("parentEntityId");

-- CreateIndex
CREATE INDEX "entity_relationships_parentEntityId_idx" ON "entity_relationships"("parentEntityId");

-- CreateIndex
CREATE INDEX "entity_relationships_childEntityId_idx" ON "entity_relationships"("childEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_accountType_idx" ON "accounts"("accountType");

-- CreateIndex
CREATE INDEX "accounts_parentAccountId_idx" ON "accounts"("parentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "estates_entityId_code_key" ON "estates"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_entityId_code_key" ON "projects"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "phases_projectId_code_key" ON "phases"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_phaseId_code_key" ON "blocks"("phaseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "floors_blockId_code_key" ON "floors"("blockId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "units_floorId_code_key" ON "units"("floorId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_entityId_code_key" ON "departments"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_entityId_code_key" ON "cost_centers"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "funding_sources_entityId_code_key" ON "funding_sources"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_code_key" ON "vendors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_entityId_name_key" ON "fiscal_periods"("entityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_journalNumber_key" ON "journal_entries"("journalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "journal_entries_entityId_status_idx" ON "journal_entries"("entityId", "status");

-- CreateIndex
CREATE INDEX "journal_entries_fiscalPeriodId_idx" ON "journal_entries"("fiscalPeriodId");

-- CreateIndex
CREATE INDEX "journal_entries_sourceType_sourceReference_idx" ON "journal_entries"("sourceType", "sourceReference");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "journal_lines_entityId_idx" ON "journal_lines"("entityId");

-- CreateIndex
CREATE INDEX "journal_lines_projectId_idx" ON "journal_lines"("projectId");

-- CreateIndex
CREATE INDEX "journal_lines_unitId_idx" ON "journal_lines"("unitId");

-- CreateIndex
CREATE INDEX "journal_lines_vendorId_idx" ON "journal_lines"("vendorId");

-- CreateIndex
CREATE INDEX "journal_lines_customerId_idx" ON "journal_lines"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journalEntryId_lineNumber_key" ON "journal_lines"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "intercompany_transactions_journalEntryId_key" ON "intercompany_transactions"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "intercompany_transactions_mirrorJournalEntryId_key" ON "intercompany_transactions"("mirrorJournalEntryId");

-- CreateIndex
CREATE INDEX "intercompany_transactions_initiatorEntityId_idx" ON "intercompany_transactions"("initiatorEntityId");

-- CreateIndex
CREATE INDEX "intercompany_transactions_counterpartyEntityId_idx" ON "intercompany_transactions"("counterpartyEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "consolidation_groups_code_key" ON "consolidation_groups"("code");

-- CreateIndex
CREATE INDEX "consolidation_ownerships_consolidationGroupId_idx" ON "consolidation_ownerships"("consolidationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "installment_schedules_allocationId_key" ON "installment_schedules"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_entityId_accountNumber_key" ON "bank_accounts"("entityId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_entityId_code_key" ON "warehouses"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_entityId_code_key" ON "stock_items"("entityId", "code");

-- CreateIndex
CREATE INDEX "stock_movements_stockItemId_warehouseId_idx" ON "stock_movements"("stockItemId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_referenceType_referenceId_idx" ON "stock_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_entityId_code_key" ON "salary_structures"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_entityId_employeeCode_key" ON "employees"("entityId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_entityId_payPeriodName_key" ON "payroll_runs"("entityId", "payPeriodName");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payrollRunId_employeeId_key" ON "payslips"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_vendorId_key" ON "Contractor"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "work_packages_projectId_code_key" ON "work_packages"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "progress_valuations_workPackageId_valuationNumber_key" ON "progress_valuations"("workPackageId", "valuationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "interim_payment_certificates_progressValuationId_key" ON "interim_payment_certificates"("progressValuationId");

-- CreateIndex
CREATE UNIQUE INDEX "interim_payment_certificates_certificateNumber_key" ON "interim_payment_certificates"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "variation_orders_workPackageId_voNumber_key" ON "variation_orders"("workPackageId", "voNumber");

-- CreateIndex
CREATE UNIQUE INDEX "retentions_workPackageId_key" ON "retentions"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "final_accounts_workPackageId_key" ON "final_accounts"("workPackageId");

-- CreateIndex
CREATE INDEX "budgets_entityId_fiscalYear_idx" ON "budgets"("entityId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_entityId_code_key" ON "budgets"("entityId", "code");

-- CreateIndex
CREATE INDEX "budget_lines_budgetId_idx" ON "budget_lines"("budgetId");

-- CreateIndex
CREATE INDEX "budget_lines_accountId_idx" ON "budget_lines"("accountId");

-- CreateIndex
CREATE INDEX "budget_lines_projectId_idx" ON "budget_lines"("projectId");

-- CreateIndex
CREATE INDEX "budget_lines_phaseId_idx" ON "budget_lines"("phaseId");

-- CreateIndex
CREATE INDEX "budget_lines_departmentId_idx" ON "budget_lines"("departmentId");

-- CreateIndex
CREATE INDEX "budget_lines_costCenterId_idx" ON "budget_lines"("costCenterId");

-- CreateIndex
CREATE INDEX "budget_lines_budgetId_period_idx" ON "budget_lines"("budgetId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "budget_revisions_budgetId_revisionNumber_key" ON "budget_revisions"("budgetId", "revisionNumber");

-- CreateIndex
CREATE INDEX "budget_revision_lines_budgetRevisionId_idx" ON "budget_revision_lines"("budgetRevisionId");

-- CreateIndex
CREATE INDEX "budget_revision_lines_budgetLineId_idx" ON "budget_revision_lines"("budgetLineId");

-- CreateIndex
CREATE INDEX "budget_transfers_budgetId_idx" ON "budget_transfers"("budgetId");

-- CreateIndex
CREATE INDEX "budget_approvals_budgetId_idx" ON "budget_approvals"("budgetId");

-- CreateIndex
CREATE INDEX "budget_commitments_budgetLineId_idx" ON "budget_commitments"("budgetLineId");

-- CreateIndex
CREATE INDEX "budget_commitments_sourceType_sourceId_idx" ON "budget_commitments"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_entityId_status_idx" ON "purchase_requisitions"("entityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_entityId_prNumber_key" ON "purchase_requisitions"("entityId", "prNumber");

-- CreateIndex
CREATE INDEX "purchase_requisition_lines_requisitionId_idx" ON "purchase_requisition_lines"("requisitionId");

-- CreateIndex
CREATE INDEX "purchase_requisition_lines_budgetLineId_idx" ON "purchase_requisition_lines"("budgetLineId");

-- CreateIndex
CREATE INDEX "purchase_orders_entityId_status_idx" ON "purchase_orders"("entityId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_entityId_poNumber_key" ON "purchase_orders"("entityId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_budgetCommitmentId_key" ON "purchase_order_lines"("budgetCommitmentId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchaseOrderId_idx" ON "purchase_order_lines"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_budgetLineId_idx" ON "purchase_order_lines"("budgetLineId");

-- CreateIndex
CREATE INDEX "procurement_grns_purchaseOrderId_idx" ON "procurement_grns"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_grns_entityId_grnNumber_key" ON "procurement_grns"("entityId", "grnNumber");

-- CreateIndex
CREATE INDEX "procurement_grn_lines_grnId_idx" ON "procurement_grn_lines"("grnId");

-- CreateIndex
CREATE INDEX "procurement_grn_lines_purchaseOrderLineId_idx" ON "procurement_grn_lines"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "vendor_invoices_purchaseOrderId_idx" ON "vendor_invoices"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invoices_entityId_vendorId_invoiceNumber_key" ON "vendor_invoices"("entityId", "vendorId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "vendor_invoice_lines_vendorInvoiceId_idx" ON "vendor_invoice_lines"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "vendor_invoice_lines_purchaseOrderLineId_idx" ON "vendor_invoice_lines"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "three_way_matches_vendorInvoiceId_idx" ON "three_way_matches"("vendorInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "three_way_matches_purchaseOrderId_grnId_vendorInvoiceId_key" ON "three_way_matches"("purchaseOrderId", "grnId", "vendorInvoiceId");

-- CreateIndex
CREATE INDEX "vendor_ledger_entries_entityId_vendorId_idx" ON "vendor_ledger_entries"("entityId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_ledger_entries_referenceType_referenceId_idx" ON "vendor_ledger_entries"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_entityId_batchNumber_key" ON "payment_batches"("entityId", "batchNumber");

-- CreateIndex
CREATE INDEX "payment_vouchers_vendorId_idx" ON "payment_vouchers"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_vouchers_entityId_voucherNumber_key" ON "payment_vouchers"("entityId", "voucherNumber");

-- CreateIndex
CREATE INDEX "payment_voucher_allocations_paymentVoucherId_idx" ON "payment_voucher_allocations"("paymentVoucherId");

-- CreateIndex
CREATE INDEX "payment_voucher_allocations_vendorInvoiceId_idx" ON "payment_voucher_allocations"("vendorInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "wht_deductions_paymentVoucherAllocationId_key" ON "wht_deductions"("paymentVoucherAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "vat_deductions_paymentVoucherAllocationId_key" ON "vat_deductions"("paymentVoucherAllocationId");

-- CreateIndex
CREATE INDEX "ar_invoices_entityId_customerId_idx" ON "ar_invoices"("entityId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ar_invoices_entityId_invoiceNumber_key" ON "ar_invoices"("entityId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "ar_invoice_lines_arInvoiceId_idx" ON "ar_invoice_lines"("arInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_entityId_receiptNumber_key" ON "receipts"("entityId", "receiptNumber");

-- CreateIndex
CREATE INDEX "receipt_allocations_receiptId_idx" ON "receipt_allocations"("receiptId");

-- CreateIndex
CREATE INDEX "receipt_allocations_arInvoiceId_idx" ON "receipt_allocations"("arInvoiceId");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_entityId_customerId_idx" ON "customer_ledger_entries"("entityId", "customerId");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_referenceType_referenceId_idx" ON "customer_ledger_entries"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "bank_statements_bankAccountId_statementDate_idx" ON "bank_statements"("bankAccountId", "statementDate");

-- CreateIndex
CREATE INDEX "bank_statement_lines_statementId_idx" ON "bank_statement_lines"("statementId");

-- CreateIndex
CREATE INDEX "reconciliation_matches_sessionId_idx" ON "reconciliation_matches"("sessionId");

-- CreateIndex
CREATE INDEX "reconciliation_matches_bankStatementLineId_idx" ON "reconciliation_matches"("bankStatementLineId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_code_key" ON "workflow_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_stage_definitions_workflowDefinitionId_sequence_key" ON "workflow_stage_definitions"("workflowDefinitionId", "sequence");

-- CreateIndex
CREATE INDEX "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "workflow_instances_workflowDefinitionId_status_idx" ON "workflow_instances"("workflowDefinitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_stage_instances_workflowInstanceId_sequence_key" ON "workflow_stage_instances"("workflowInstanceId", "sequence");

-- CreateIndex
CREATE INDEX "workflow_actions_workflowInstanceId_idx" ON "workflow_actions"("workflowInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_branding_profiles_entityId_key" ON "entity_branding_profiles"("entityId");

-- CreateIndex
CREATE INDEX "brand_assets_entityId_assetType_idx" ON "brand_assets"("entityId", "assetType");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_entityId_templateType_code_key" ON "document_templates"("entityId", "templateType", "code");

-- CreateIndex
CREATE UNIQUE INDEX "entity_profiles_entityId_key" ON "entity_profiles"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "translation_entries_locale_namespace_idx" ON "translation_entries"("locale", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "translation_entries_locale_namespace_key_key" ON "translation_entries"("locale", "namespace", "key");

-- CreateIndex
CREATE INDEX "employee_documents_employeeId_idx" ON "employee_documents"("employeeId");

-- CreateIndex
CREATE INDEX "employee_next_of_kin_employeeId_idx" ON "employee_next_of_kin"("employeeId");

-- CreateIndex
CREATE INDEX "employee_emergency_contacts_employeeId_idx" ON "employee_emergency_contacts"("employeeId");

-- CreateIndex
CREATE INDEX "employee_asset_assignments_employeeId_idx" ON "employee_asset_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "employee_onboarding_tasks_employeeId_idx" ON "employee_onboarding_tasks"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_entityId_code_key" ON "leave_types"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_leaveTypeId_year_key" ON "leave_balances"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_status_idx" ON "leave_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_entityId_date_key" ON "public_holidays"("entityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_entityId_code_key" ON "shifts"("entityId", "code");

-- CreateIndex
CREATE INDEX "shift_assignments_shiftId_idx" ON "shift_assignments"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employeeId_date_key" ON "shift_assignments"("employeeId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_date_idx" ON "attendance_records"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_date_key" ON "attendance_records"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_entityId_deviceIdentifier_key" ON "biometric_devices"("entityId", "deviceIdentifier");

-- CreateIndex
CREATE INDEX "biometric_event_logs_deviceId_processed_idx" ON "biometric_event_logs"("deviceId", "processed");

-- CreateIndex
CREATE INDEX "biometric_event_logs_employeeId_idx" ON "biometric_event_logs"("employeeId");

-- CreateIndex
CREATE INDEX "disciplinary_cases_employeeId_status_idx" ON "disciplinary_cases"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_exits_employeeId_key" ON "employee_exits"("employeeId");

-- CreateIndex
CREATE INDEX "exit_clearance_items_employeeExitId_idx" ON "exit_clearance_items"("employeeExitId");

-- CreateIndex
CREATE INDEX "job_requisitions_entityId_status_idx" ON "job_requisitions"("entityId", "status");

-- CreateIndex
CREATE INDEX "vacancies_entityId_status_idx" ON "vacancies"("entityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_portalUserId_key" ON "candidates"("portalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidate_documents_candidateId_idx" ON "candidate_documents"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_hiredEmployeeId_key" ON "job_applications"("hiredEmployeeId");

-- CreateIndex
CREATE INDEX "job_applications_vacancyId_stage_idx" ON "job_applications"("vacancyId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_vacancyId_candidateId_key" ON "job_applications"("vacancyId", "candidateId");

-- CreateIndex
CREATE INDEX "interviews_jobApplicationId_idx" ON "interviews"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_panelists_interviewId_employeeId_key" ON "interview_panelists"("interviewId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_interviewId_employeeId_key" ON "interview_feedback"("interviewId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_jobApplicationId_key" ON "offers"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "background_checks_jobApplicationId_key" ON "background_checks"("jobApplicationId");

-- CreateIndex
CREATE INDEX "employment_events_employeeId_effectiveDate_idx" ON "employment_events"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "performance_cycles_entityId_name_key" ON "performance_cycles"("entityId", "name");

-- CreateIndex
CREATE INDEX "goals_employeeId_idx" ON "goals"("employeeId");

-- CreateIndex
CREATE INDEX "kpis_employeeId_idx" ON "kpis"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_name_key" ON "competencies"("name");

-- CreateIndex
CREATE INDEX "competency_assessments_employeeId_idx" ON "competency_assessments"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_employeeId_cycleId_key" ON "performance_reviews"("employeeId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "training_courses_entityId_code_key" ON "training_courses"("entityId", "code");

-- CreateIndex
CREATE INDEX "training_sessions_courseId_idx" ON "training_sessions"("courseId");

-- CreateIndex
CREATE INDEX "training_enrollments_employeeId_idx" ON "training_enrollments"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollments_sessionId_employeeId_key" ON "training_enrollments"("sessionId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_trainingEnrollmentId_key" ON "certifications"("trainingEnrollmentId");

-- CreateIndex
CREATE INDEX "certifications_employeeId_idx" ON "certifications"("employeeId");

-- CreateIndex
CREATE INDEX "succession_plans_entityId_criticality_idx" ON "succession_plans"("entityId", "criticality");

-- CreateIndex
CREATE UNIQUE INDEX "succession_candidates_successionPlanId_employeeId_key" ON "succession_candidates"("successionPlanId", "employeeId");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "job_run_logs_queueName_status_idx" ON "job_run_logs"("queueName", "status");

-- CreateIndex
CREATE INDEX "job_run_logs_jobId_idx" ON "job_run_logs"("jobId");

-- CreateIndex
CREATE INDEX "job_run_logs_createdAt_idx" ON "job_run_logs"("createdAt");

-- =========================================================
-- FOREIGN KEYS / CONSTRAINTS
-- =========================================================
-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_entity_access" ADD CONSTRAINT "user_entity_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_entity_access" ADD CONSTRAINT "user_entity_access_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_accounts" ADD CONSTRAINT "entity_accounts_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_accounts" ADD CONSTRAINT "entity_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estates" ADD CONSTRAINT "estates_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_sources" ADD CONSTRAINT "funding_sources_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_number_sequences" ADD CONSTRAINT "journal_number_sequences_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_transactions" ADD CONSTRAINT "intercompany_transactions_initiatorEntityId_fkey" FOREIGN KEY ("initiatorEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_transactions" ADD CONSTRAINT "intercompany_transactions_counterpartyEntityId_fkey" FOREIGN KEY ("counterpartyEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_transactions" ADD CONSTRAINT "intercompany_transactions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_eliminations" ADD CONSTRAINT "intercompany_eliminations_intercompanyTransactionId_fkey" FOREIGN KEY ("intercompanyTransactionId") REFERENCES "intercompany_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_eliminations" ADD CONSTRAINT "intercompany_eliminations_consolidationGroupId_fkey" FOREIGN KEY ("consolidationGroupId") REFERENCES "consolidation_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidation_ownerships" ADD CONSTRAINT "consolidation_ownerships_consolidationGroupId_fkey" FOREIGN KEY ("consolidationGroupId") REFERENCES "consolidation_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidation_ownerships" ADD CONSTRAINT "consolidation_ownerships_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidation_ownerships" ADD CONSTRAINT "consolidation_ownerships_childEntityId_fkey" FOREIGN KEY ("childEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_sale_allocations" ADD CONSTRAINT "unit_sale_allocations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_sale_allocations" ADD CONSTRAINT "unit_sale_allocations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_lines" ADD CONSTRAINT "installment_lines_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "installment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issue_lines" ADD CONSTRAINT "material_issue_lines_materialIssueId_fkey" FOREIGN KEY ("materialIssueId") REFERENCES "material_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issue_lines" ADD CONSTRAINT "material_issue_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "near_misses" ADD CONSTRAINT "near_misses_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "near_misses" ADD CONSTRAINT "near_misses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issuances" ADD CONSTRAINT "ppe_issuances_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issuances" ADD CONSTRAINT "ppe_issuances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toolbox_talks" ADD CONSTRAINT "toolbox_talks_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toolbox_talks" ADD CONSTRAINT "toolbox_talks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "incident_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "near_misses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklists" ADD CONSTRAINT "inspection_checklists_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklists" ADD CONSTRAINT "inspection_checklists_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "inspection_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_lines" ADD CONSTRAINT "boq_lines_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "boqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_valuations" ADD CONSTRAINT "progress_valuations_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interim_payment_certificates" ADD CONSTRAINT "interim_payment_certificates_progressValuationId_fkey" FOREIGN KEY ("progressValuationId") REFERENCES "progress_valuations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_orders" ADD CONSTRAINT "variation_orders_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retentions" ADD CONSTRAINT "retentions_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_releases" ADD CONSTRAINT "retention_releases_retentionId_fkey" FOREIGN KEY ("retentionId") REFERENCES "retentions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_accounts" ADD CONSTRAINT "final_accounts_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "loan_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_lines" ADD CONSTRAINT "repayment_lines_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "loan_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_accruals" ADD CONSTRAINT "interest_accruals_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "loan_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_placements" ADD CONSTRAINT "investment_placements_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revision_lines" ADD CONSTRAINT "budget_revision_lines_budgetRevisionId_fkey" FOREIGN KEY ("budgetRevisionId") REFERENCES "budget_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revision_lines" ADD CONSTRAINT "budget_revision_lines_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_fromLineId_fkey" FOREIGN KEY ("fromLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_toLineId_fkey" FOREIGN KEY ("toLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_approvals" ADD CONSTRAINT "budget_approvals_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_approvals" ADD CONSTRAINT "budget_approvals_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_commitments" ADD CONSTRAINT "budget_commitments_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_commitments" ADD CONSTRAINT "budget_commitments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "purchase_requisition_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_budgetCommitmentId_fkey" FOREIGN KEY ("budgetCommitmentId") REFERENCES "budget_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grns" ADD CONSTRAINT "procurement_grns_grIrClearingAccountId_fkey" FOREIGN KEY ("grIrClearingAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grn_lines" ADD CONSTRAINT "procurement_grn_lines_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "procurement_grns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grn_lines" ADD CONSTRAINT "procurement_grn_lines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_grn_lines" ADD CONSTRAINT "procurement_grn_lines_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_lines" ADD CONSTRAINT "vendor_invoice_lines_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_lines" ADD CONSTRAINT "vendor_invoice_lines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoice_lines" ADD CONSTRAINT "vendor_invoice_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "procurement_grns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_entries_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_voucher_allocations" ADD CONSTRAINT "payment_voucher_allocations_paymentVoucherId_fkey" FOREIGN KEY ("paymentVoucherId") REFERENCES "payment_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_voucher_allocations" ADD CONSTRAINT "payment_voucher_allocations_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wht_deductions" ADD CONSTRAINT "wht_deductions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wht_deductions" ADD CONSTRAINT "wht_deductions_paymentVoucherAllocationId_fkey" FOREIGN KEY ("paymentVoucherAllocationId") REFERENCES "payment_voucher_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wht_deductions" ADD CONSTRAINT "wht_deductions_taxAuthorityAccountId_fkey" FOREIGN KEY ("taxAuthorityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_deductions" ADD CONSTRAINT "vat_deductions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_deductions" ADD CONSTRAINT "vat_deductions_paymentVoucherAllocationId_fkey" FOREIGN KEY ("paymentVoucherAllocationId") REFERENCES "payment_voucher_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_deductions" ADD CONSTRAINT "vat_deductions_taxAuthorityAccountId_fkey" FOREIGN KEY ("taxAuthorityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_lines" ADD CONSTRAINT "ar_invoice_lines_arInvoiceId_fkey" FOREIGN KEY ("arInvoiceId") REFERENCES "ar_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_lines" ADD CONSTRAINT "ar_invoice_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_lines" ADD CONSTRAINT "ar_invoice_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_lines" ADD CONSTRAINT "ar_invoice_lines_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_arInvoiceId_fkey" FOREIGN KEY ("arInvoiceId") REFERENCES "ar_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_bankGlAccountId_fkey" FOREIGN KEY ("bankGlAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reconciliation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_bankStatementLineId_fkey" FOREIGN KEY ("bankStatementLineId") REFERENCES "bank_statement_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stage_definitions" ADD CONSTRAINT "workflow_stage_definitions_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approval_rules" ADD CONSTRAINT "workflow_approval_rules_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approval_rules" ADD CONSTRAINT "workflow_approval_rules_stageDefinitionId_fkey" FOREIGN KEY ("stageDefinitionId") REFERENCES "workflow_stage_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stage_instances" ADD CONSTRAINT "workflow_stage_instances_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "workflow_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stage_instances" ADD CONSTRAINT "workflow_stage_instances_stageDefinitionId_fkey" FOREIGN KEY ("stageDefinitionId") REFERENCES "workflow_stage_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "workflow_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "workflow_stage_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_branding_profiles" ADD CONSTRAINT "entity_branding_profiles_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_profiles" ADD CONSTRAINT "entity_profiles_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_next_of_kin" ADD CONSTRAINT "employee_next_of_kin_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_asset_assignments" ADD CONSTRAINT "employee_asset_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_event_logs" ADD CONSTRAINT "biometric_event_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "biometric_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_event_logs" ADD CONSTRAINT "biometric_event_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_exits" ADD CONSTRAINT "employee_exits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_clearance_items" ADD CONSTRAINT "exit_clearance_items_employeeExitId_fkey" FOREIGN KEY ("employeeExitId") REFERENCES "employee_exits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_jobRequisitionId_fkey" FOREIGN KEY ("jobRequisitionId") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_hiredEmployeeId_fkey" FOREIGN KEY ("hiredEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_trainingEnrollmentId_fkey" FOREIGN KEY ("trainingEnrollmentId") REFERENCES "training_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_plans" ADD CONSTRAINT "succession_plans_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_plans" ADD CONSTRAINT "succession_plans_incumbentEmployeeId_fkey" FOREIGN KEY ("incumbentEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_candidates" ADD CONSTRAINT "succession_candidates_successionPlanId_fkey" FOREIGN KEY ("successionPlanId") REFERENCES "succession_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_candidates" ADD CONSTRAINT "succession_candidates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
