import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportingService } from '../reporting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';
import { SchedulingService } from '../../pmo/scheduling.service';
import { RiskIssueService } from '../../pmo/risk-issue.service';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

/**
 * NOTE: this module had zero test coverage before Phase 2. This file only
 * covers the RLS gating added in this slice â€” each report method now calls
 * assertEntityAccess() before running its $queryRaw, since the underlying
 * views can't be filtered with RowLevelSecurityService's Prisma `where`
 * output the way a normal model query can.
 */
describe('ReportingService', () => {
  let service: ReportingService;
  let prisma: any;
  let scheduling: any;
  let riskIssue: any;

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ok: true }]) };
    scheduling = { getGanttData: jest.fn(), computeEarnedValue: jest.fn() };
    riskIssue = { getRiskIssueSummary: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportingService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchedulingService, useValue: scheduling },
        { provide: RiskIssueService, useValue: riskIssue },
      ],
    }).compile();

    service = moduleRef.get(ReportingService);
  });

  describe('Row Level Security (Phase 2)', () => {
    const restrictedScope: SecurityScope = {
      ...buildUnrestrictedScope(),
      isSystemAdmin: false,
      entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
    };

    it('runs the query when the caller has access to the requested entity', async () => {
      const result = await service.budgetVsActual(restrictedScope, 'ent-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('rejects budgetVsActual for an entity outside the caller\'s scope', async () => {
      await expect(service.budgetVsActual(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects projectProfitability for an entity outside the caller\'s scope', async () => {
      await expect(service.projectProfitability(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects vendorAging for an entity outside the caller\'s scope', async () => {
      await expect(service.vendorAging(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects customerAging for an entity outside the caller\'s scope', async () => {
      await expect(service.customerAging(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects cashForecast for an entity outside the caller\'s scope', async () => {
      await expect(service.cashForecast(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects bankReconciliationSummary for an entity outside the caller\'s scope', async () => {
      await expect(service.bankReconciliationSummary(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects consolidatedTrialBalance for an entity outside the caller\'s scope', async () => {
      await expect(service.consolidatedTrialBalance(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects trialBalance for an entity outside the caller\'s scope', async () => {
      await expect(service.trialBalance(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects generalLedger for an entity outside the caller\'s scope', async () => {
      await expect(service.generalLedger(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('allows every report for a system admin regardless of entity', async () => {
      const scope = buildUnrestrictedScope();
      await expect(service.consolidatedTrialBalance(scope, 'any-entity')).resolves.toEqual([{ ok: true }]);
      await expect(service.trialBalance(scope, 'any-entity')).resolves.toEqual([{ ok: true }]);
      await expect(service.generalLedger(scope, 'any-entity')).resolves.toEqual([{ ok: true }]);
    });

    // Phase 5A â€” Real Estate Analytics (additive)
    it('rejects salesVelocity for an entity outside the caller\'s scope', async () => {
      await expect(service.salesVelocity(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects inventoryAgeing for an entity outside the caller\'s scope', async () => {
      await expect(service.inventoryAgeing(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects absorptionRate for an entity outside the caller\'s scope', async () => {
      await expect(service.absorptionRate(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects unsoldUnitsDashboard for an entity outside the caller\'s scope', async () => {
      await expect(service.unsoldUnitsDashboard(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    });

    // Release â€” CRM Reporting Integration (additive)
    it('rejects crmPipeline for an entity outside the caller\'s scope', async () => {
      await expect(service.crmPipeline(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    // Release K â€” PMO Reporting Integration (additive)
    it('rejects pmoProjectPerformance for an entity outside the caller\'s scope, without calling SchedulingService', async () => {
      await expect(service.pmoProjectPerformance(restrictedScope, 'ent-2', 'proj-1')).rejects.toThrow(ForbiddenException);
      expect(scheduling.getGanttData).not.toHaveBeenCalled();
      expect(scheduling.computeEarnedValue).not.toHaveBeenCalled();
    });

    it('rejects pmoRiskIssueRegister for an entity outside the caller\'s scope, without calling RiskIssueService', async () => {
      await expect(service.pmoRiskIssueRegister(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(riskIssue.getRiskIssueSummary).not.toHaveBeenCalled();
    });

    it('runs salesVelocity when the caller has access to the requested entity, with an optional projectId filter', async () => {
      const result = await service.salesVelocity(restrictedScope, 'ent-1', 'proj-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    // Release IF.1, Checkpoint J â€” Bank Integration Framework Reporting Integration
    it('rejects monoLinkedAccountsRegister for an entity outside the caller\'s scope', async () => {
      await expect(service.monoLinkedAccountsRegister(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('runs monoLinkedAccountsRegister when the caller has access to the requested entity', async () => {
      const result = await service.monoLinkedAccountsRegister(restrictedScope, 'ent-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  /**
   * Phase 3A â€” Statutory Trial Balance and General Ledger report methods.
   * These cover the query construction (which optional filters get applied)
   * on top of the RLS gating already covered above.
   */
  describe('Phase 3A statutory reports', () => {
    const scope = buildUnrestrictedScope();

    it('runs trialBalance for an entity with no fiscal period filter', async () => {
      const result = await service.trialBalance(scope, 'ent-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs trialBalance scoped to a single fiscal period', async () => {
      const result = await service.trialBalance(scope, 'ent-1', 'fp-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs generalLedger with no filters (whole entity)', async () => {
      const result = await service.generalLedger(scope, 'ent-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs generalLedger narrowed to one account and date range', async () => {
      const result = await service.generalLedger(scope, 'ent-1', {
        accountId: 'acct-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs financialRatios for an entity with no fiscal period filter', async () => {
      const result = await service.financialRatios(scope, 'ent-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs financialRatios scoped to a single fiscal period', async () => {
      const result = await service.financialRatios(scope, 'ent-1', 'fp-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs segmentReporting across all segment types', async () => {
      const result = await service.segmentReporting(scope, 'ent-1', 'fp-1');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('runs segmentReporting narrowed to one segment type', async () => {
      const result = await service.segmentReporting(scope, 'ent-1', 'fp-1', 'PROJECT');
      expect(result).toEqual([{ ok: true }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Phase 3A ratios & segment reporting RLS', () => {
    const restrictedScope: SecurityScope = {
      ...buildUnrestrictedScope(),
      isSystemAdmin: false,
      entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
    };

    it('rejects financialRatios for an entity outside the caller\'s scope', async () => {
      await expect(service.financialRatios(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects segmentReporting for an entity outside the caller\'s scope', async () => {
      await expect(service.segmentReporting(restrictedScope, 'ent-2', 'fp-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  /**
   * Phase 3A â€” Statement of Profit or Loss and Statement of Financial
   * Position. Unlike the other reports, these compute section subtotals
   * in TypeScript on top of the raw view rows, so coverage here focuses on
   * that arithmetic rather than just RLS gating.
   */
  /**
   * Phase 3A â€” Statement of Cash Flows. Uses one realistic seeded set of
   * account movements for both assertions: that INDIRECT computes the
   * right operating/investing/financing/net-change figures, and that
   * DIRECT reconstructs the exact same operating total from the same
   * movements (reconcilesToIndirect), not just a plausible-looking one.
   */
  describe('Phase 3A statement of cash flows', () => {
    const scope = buildUnrestrictedScope();

    const cashFlowRows = [
      {
        account_category: 'CURRENT_ASSET',
        account_name: 'Cash at Bank',
        ifrs_mapping: null,
        cash_flow_section: 'CASH_AND_EQUIVALENTS',
        opening_balance: 1000,
        period_net_movement: 10,
        closing_balance: 1010,
      },
      {
        account_category: 'CURRENT_ASSET',
        account_name: 'Trade Receivables',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_WORKING_CAPITAL',
        opening_balance: 0,
        period_net_movement: 200,
        closing_balance: 200,
      },
      {
        account_category: 'CURRENT_ASSET',
        account_name: 'Inventory',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_WORKING_CAPITAL',
        opening_balance: 0,
        period_net_movement: 100,
        closing_balance: 100,
      },
      {
        account_category: 'CURRENT_ASSET',
        account_name: 'Prepaid Expenses',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_WORKING_CAPITAL',
        opening_balance: 0,
        period_net_movement: 50,
        closing_balance: 50,
      },
      {
        account_category: 'CURRENT_LIABILITY',
        account_name: 'Trade Payables',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_WORKING_CAPITAL',
        opening_balance: 0,
        period_net_movement: 150,
        closing_balance: 150,
      },
      {
        account_category: 'CURRENT_LIABILITY',
        account_name: 'Accrued Expenses',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_WORKING_CAPITAL',
        opening_balance: 0,
        period_net_movement: 30,
        closing_balance: 30,
      },
      {
        account_category: 'NON_CURRENT_ASSET',
        account_name: 'Property, Plant & Equipment',
        ifrs_mapping: null,
        cash_flow_section: 'INVESTING',
        opening_balance: 0,
        period_net_movement: 400,
        closing_balance: 400,
      },
      {
        account_category: 'NON_CURRENT_LIABILITY',
        account_name: 'Bank Loan',
        ifrs_mapping: null,
        cash_flow_section: 'FINANCING',
        opening_balance: 0,
        period_net_movement: 250,
        closing_balance: 250,
      },
      {
        account_type: 'EXPENSE',
        account_category: 'OPERATING_EXPENSE',
        account_name: 'Depreciation Expense',
        ifrs_mapping: null,
        cash_flow_section: 'OPERATING_PL',
        opening_balance: 0,
        period_net_movement: 80,
        closing_balance: 0,
      },
    ];

    const plRows = [
      { statement_section: 'REVENUE', amount: 1000, period_name: '2026-01' },
      { statement_section: 'COST_OF_SALES', amount: 400, period_name: '2026-01' },
      { statement_section: 'OPERATING_EXPENSE', amount: 300, period_name: '2026-01' },
      { statement_section: 'FINANCE_EXPENSE', amount: 20, period_name: '2026-01' },
      { statement_section: 'TAX_EXPENSE', amount: 30, period_name: '2026-01' },
    ];

    beforeEach(() => {
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValueOnce(cashFlowRows) // buildCashFlow's own vw_statement_cash_flow query
        .mockResolvedValueOnce(plRows); // buildProfitOrLoss, called from within buildCashFlow
    });

    it('computes INDIRECT method operating/investing/financing correctly', async () => {
      const result = await service.statementOfCashFlows(scope, 'ent-1', 'fp-1', 'INDIRECT');

      expect(result.operatingActivities).toBe(160); // netProfit 250 + D&A 80 - 170 working capital use
      expect(result.investingActivities).toBe(-400); // PP&E purchase
      expect(result.financingActivities).toBe(250); // loan drawdown
      expect(result.netChangeInCash).toBe(10);
      expect(result.openingCash).toBe(1000);
      expect(result.closingCash).toBe(1010);
      expect(result.reconcilesToLedger).toBe(true);
    });

    it('computes DIRECT method and reconciles exactly to the INDIRECT operating total', async () => {
      const result: any = await service.statementOfCashFlows(scope, 'ent-1', 'fp-1', 'DIRECT');

      expect(result.operating.cashReceivedFromCustomers).toBe(800); // 1000 revenue - 200 AR increase
      expect(result.operating.cashPaidToSuppliers).toBe(-350); // -(400 COGS + 100 inventory - 150 AP)
      expect(result.operating.cashPaidForOperatingExpenses).toBe(-220); // -(300 opex - 80 D&A)
      expect(result.operating.netMovementInOtherWorkingCapital).toBe(-20); // -50 prepayment + 30 accrual
      expect(result.operating.interestPaid).toBe(-20);
      expect(result.operating.taxPaid).toBe(-30);
      expect(result.operating.reconcilesToIndirect).toBe(true);
      expect(result.operatingActivities).toBe(160);
    });
  });

  describe('Phase 3A statement subtotal computation', () => {
    const scope = buildUnrestrictedScope();

    it('rejects statementOfProfitOrLoss for an entity outside the caller\'s scope', async () => {
      const restrictedScope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };
      await expect(service.statementOfProfitOrLoss(restrictedScope, 'ent-2', 'fp-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('computes P&L subtotals down to net profit from view rows', async () => {
      prisma.$queryRaw = jest.fn().mockResolvedValue([
        { statement_section: 'REVENUE', amount: 1000, period_name: '2026-01' },
        { statement_section: 'COST_OF_SALES', amount: 400, period_name: '2026-01' },
        { statement_section: 'OPERATING_EXPENSE', amount: 200, period_name: '2026-01' },
        { statement_section: 'FINANCE_EXPENSE', amount: 50, period_name: '2026-01' },
        { statement_section: 'TAX_EXPENSE', amount: 70, period_name: '2026-01' },
      ]);

      const { current } = await service.statementOfProfitOrLoss(scope, 'ent-1', 'fp-1');

      expect(current.totalRevenue).toBe(1000);
      expect(current.grossProfit).toBe(600); // 1000 - 400
      expect(current.operatingProfit).toBe(400); // 600 - 200
      expect(current.profitBeforeTax).toBe(350); // 400 - 50
      expect(current.netProfit).toBe(280); // 350 - 70
    });

    it('includes a comparative period when comparativeFiscalPeriodId is supplied', async () => {
      prisma.$queryRaw = jest.fn().mockResolvedValue([]);
      const result = await service.statementOfProfitOrLoss(scope, 'ent-1', 'fp-2', 'fp-1');
      expect(result.current).toBeDefined();
      expect(result.comparative).toBeDefined();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('omits comparative when comparativeFiscalPeriodId is not supplied', async () => {
      prisma.$queryRaw = jest.fn().mockResolvedValue([]);
      const result = await service.statementOfProfitOrLoss(scope, 'ent-1', 'fp-2');
      expect(result.comparative).toBeUndefined();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('computes balance sheet totals and flags an unbalanced ledger honestly', async () => {
      prisma.$queryRaw = jest.fn().mockResolvedValue([
        { statement_section: 'ASSETS_CURRENT', closing_balance: 500, period_name: '2026-01' },
        { statement_section: 'ASSETS_NON_CURRENT', closing_balance: 1500, period_name: '2026-01' },
        { statement_section: 'LIABILITIES_CURRENT', closing_balance: 300, period_name: '2026-01' },
        { statement_section: 'LIABILITIES_NON_CURRENT', closing_balance: 700, period_name: '2026-01' },
        { statement_section: 'EQUITY', closing_balance: 900, period_name: '2026-01' },
      ]);

      const { current } = await service.statementOfFinancialPosition(scope, 'ent-1', 'fp-1');

      expect(current.totalAssets).toBe(2000); // 500 + 1500
      expect(current.totalLiabilities).toBe(1000); // 300 + 700
      expect(current.totalEquity).toBe(900);
      // 2000 assets vs 1000 + 900 = 1900 liabilities+equity -> does not balance,
      // and the service should say so rather than silently plugging the gap.
      expect(current.balances).toBe(false);
    });
  });

  describe('Phase 3B statement of changes in equity & comprehensive income', () => {
    const scope = buildUnrestrictedScope();

    const plRows = [
      { statement_section: 'REVENUE', amount: 1000, period_name: '2026-01' },
      { statement_section: 'COST_OF_SALES', amount: 400, period_name: '2026-01' },
      { statement_section: 'OPERATING_EXPENSE', amount: 200, period_name: '2026-01' },
      { statement_section: 'FINANCE_EXPENSE', amount: 50, period_name: '2026-01' },
      { statement_section: 'TAX_EXPENSE', amount: 70, period_name: '2026-01' },
    ]; // netProfit = 280, same figures as the P&L subtotal test above

    const equityRows = [
      { account_category: 'SHARE_CAPITAL', account_name: 'Share Capital', ifrs_mapping: null, opening_balance: 5000, period_net_movement: 0, closing_balance: 5000, period_name: '2026-01' },
      { account_category: 'SHARE_CAPITAL', account_name: 'Share Premium', ifrs_mapping: 'IAS 1 - Share Premium', opening_balance: 0, period_net_movement: 200, closing_balance: 200, period_name: '2026-01' },
      { account_category: 'RETAINED_EARNINGS', account_name: 'Retained Earnings', ifrs_mapping: null, opening_balance: 1000, period_net_movement: 280, closing_balance: 1280, period_name: '2026-01' },
      { account_category: 'RETAINED_EARNINGS', account_name: 'Dividends Declared', ifrs_mapping: 'IAS 1 - Dividends Declared', opening_balance: 0, period_net_movement: -50, closing_balance: -50, period_name: '2026-01' },
      { account_category: 'OTHER_EQUITY', account_name: 'Revaluation Reserve', ifrs_mapping: 'IAS 16 - Revaluation Surplus', opening_balance: 100, period_net_movement: 40, closing_balance: 140, period_name: '2026-01' },
      { account_category: 'OTHER_EQUITY', account_name: 'Foreign Currency Translation Reserve', ifrs_mapping: 'IAS 21 - Foreign Currency Translation Reserve', opening_balance: 60, period_net_movement: -10, closing_balance: 50, period_name: '2026-01' },
      { account_category: 'OTHER_EQUITY', account_name: 'Other Equity Reserves', ifrs_mapping: 'IAS 1 - Other Reserves', opening_balance: 20, period_net_movement: 5, closing_balance: 25, period_name: '2026-01' },
    ]; // components total: opening 6180, closing 6645

    const balancedFinancialPositionRows = [
      { statement_section: 'EQUITY', closing_balance: 6645, period_name: '2026-01' },
    ];

    describe('statementOfChangesInEquity', () => {
      beforeEach(() => {
        prisma.$queryRaw = jest
          .fn()
          .mockResolvedValueOnce(plRows) // buildChangesInEquity's own buildProfitOrLoss call (no comparative passed in)
          .mockResolvedValueOnce(equityRows) // vw_statement_changes_in_equity
          .mockResolvedValueOnce(balancedFinancialPositionRows); // buildFinancialPosition, for the reconciliation check
      });

      it('classifies rows into the six equity components correctly', async () => {
        const { current } = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-1');

        expect(current.opening.shareCapital).toBe(5000);
        expect(current.opening.sharePremium).toBe(0);
        expect(current.opening.retainedEarnings).toBe(1000);
        expect(current.opening.revaluationReserve).toBe(100);
        expect(current.opening.foreignCurrencyTranslationReserve).toBe(60);
        expect(current.opening.otherReserves).toBe(20);
        expect(current.opening.total).toBe(6180);

        expect(current.closing.retainedEarnings).toBe(1230); // Retained Earnings (1280) + Dividends Declared (-50)
        expect(current.closing.total).toBe(6645);
      });

      it('attributes Profit for the Year, OCI, and Dividends to the right movement rows', async () => {
        const { current } = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-1');

        expect(current.profitForYear.retainedEarnings).toBe(280);
        expect(current.profitForYear.total).toBe(280);
        expect(current.oci.revaluationReserve).toBe(40);
        expect(current.oci.foreignCurrencyTranslationReserve).toBe(-10);
        expect(current.oci.total).toBe(30);
        expect(current.dividends.retainedEarnings).toBe(-50);
        expect(current.dividends.total).toBe(-50);
      });

      it('plugs unexplained movements (share issuance, other reserves) into otherMovements, and foots the grid exactly', async () => {
        const { current } = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-1');

        expect(current.otherMovements.sharePremium).toBe(200); // share issuance â€” no P&L/OCI/dividend driver
        expect(current.otherMovements.otherReserves).toBe(5); // unclassified movement, reported not hidden
        expect(current.otherMovements.retainedEarnings).toBe(0); // fully explained by profit + dividends
        expect(current.otherMovements.revaluationReserve).toBe(0); // fully explained by OCI

        const footedTotal =
          current.opening.total +
          current.profitForYear.total +
          current.oci.total +
          current.dividends.total +
          current.otherMovements.total;
        expect(footedTotal).toBeCloseTo(current.closing.total, 5);
      });

      it('reconciles closing equity to the Balance Sheet total', async () => {
        const { current } = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-1');
        expect(current.reconcilesToBalanceSheet).toBe(true);
      });

      it('flags a mismatch against the Balance Sheet honestly rather than hiding it', async () => {
        prisma.$queryRaw = jest
          .fn()
          .mockResolvedValueOnce(plRows)
          .mockResolvedValueOnce(equityRows)
          .mockResolvedValueOnce([{ statement_section: 'EQUITY', closing_balance: 9999, period_name: '2026-01' }]);

        const { current } = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-1');
        expect(current.reconcilesToBalanceSheet).toBe(false);
      });

      it('rejects statementOfChangesInEquity for an entity outside the caller\'s scope', async () => {
        const restrictedScope: SecurityScope = {
          ...buildUnrestrictedScope(),
          isSystemAdmin: false,
          entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        };
        await expect(service.statementOfChangesInEquity(restrictedScope, 'ent-2', 'fp-1')).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('includes a comparative period when comparativeFiscalPeriodId is supplied', async () => {
        prisma.$queryRaw = jest.fn().mockResolvedValue([]);
        const result = await service.statementOfChangesInEquity(scope, 'ent-1', 'fp-2', 'fp-1');
        expect(result.current).toBeDefined();
        expect(result.comparative).toBeDefined();
      });
    });

    describe('statementOfComprehensiveIncome', () => {
      beforeEach(() => {
        prisma.$queryRaw = jest
          .fn()
          .mockResolvedValueOnce(plRows) // buildComprehensiveIncome's own buildProfitOrLoss call
          .mockResolvedValueOnce(equityRows) // vw_statement_changes_in_equity, called with netProfit already known
          .mockResolvedValueOnce(balancedFinancialPositionRows); // buildFinancialPosition, inside buildChangesInEquity
      });

      it('reuses buildProfitOrLoss verbatim for the Profit or Loss section', async () => {
        const { current } = await service.statementOfComprehensiveIncome(scope, 'ent-1', 'fp-1');
        expect(current.totalRevenue).toBe(1000);
        expect(current.netProfit).toBe(280);
      });

      it('scopes OCI to Revaluation Reserve and FCTR movements only', async () => {
        const { current } = await service.statementOfComprehensiveIncome(scope, 'ent-1', 'fp-1');
        expect(current.oci.revaluationReserve).toBe(40);
        expect(current.oci.foreignCurrencyTranslationReserve).toBe(-10);
        expect(current.oci.total).toBe(30);
      });

      it('computes Total Comprehensive Income as net profit plus OCI', async () => {
        const { current } = await service.statementOfComprehensiveIncome(scope, 'ent-1', 'fp-1');
        expect(current.totalComprehensiveIncome).toBe(310); // 280 + 30
      });

      it('does not double-count net profit as its own buildProfitOrLoss call inside buildChangesInEquity', async () => {
        await service.statementOfComprehensiveIncome(scope, 'ent-1', 'fp-1');
        // Exactly 3 queries: P&L, changes-in-equity, and the balance-sheet
        // reconciliation check â€” NOT 4, which is what an extra internal
        // buildProfitOrLoss call inside buildChangesInEquity would cost.
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
      });

      it('rejects statementOfComprehensiveIncome for an entity outside the caller\'s scope', async () => {
        const restrictedScope: SecurityScope = {
          ...buildUnrestrictedScope(),
          isSystemAdmin: false,
          entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        };
        await expect(service.statementOfComprehensiveIncome(restrictedScope, 'ent-2', 'fp-1')).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('includes a comparative period when comparativeFiscalPeriodId is supplied', async () => {
        prisma.$queryRaw = jest.fn().mockResolvedValue([]);
        const result = await service.statementOfComprehensiveIncome(scope, 'ent-1', 'fp-2', 'fp-1');
        expect(result.current).toBeDefined();
        expect(result.comparative).toBeDefined();
      });
    });
  });

  describe('Phase 3C â€” IFRS Notes to the Financial Statements', () => {
    const scope = buildUnrestrictedScope();

    /** One row per note-key covered, deliberately including at least one
     *  account each for: an equity split (share capital vs premium), a
     *  PPE/accum-depreciation contra pair (for rollforward math), a
     *  liability, and one CURRENT_ASSET row with no matching keyword
     *  (exercises the otherCurrentAssets residual bucket) plus one
     *  NON_CURRENT_ASSET row with no matching keyword (exercises the
     *  genuinely-unclassified bucket, since there is no residual note for
     *  non-current assets â€” see classifySofpRow's doc comment). */
    const sofpRows = [
      // PPE rollforward: cost + accumulated depreciation contra pair
      { account_id: 'a-ppe-cost', account_code: '1500', account_name: 'Property, Plant & Equipment - Cost', account_category: 'NON_CURRENT_ASSET', ifrs_mapping: 'IAS 16', statement_section: 'ASSETS_NON_CURRENT', opening_balance: 1000, closing_balance: 1400, period_name: '2026-01' },
      { account_id: 'a-ppe-dep', account_code: '1501', account_name: 'Accumulated Depreciation - PPE', account_category: 'NON_CURRENT_ASSET', ifrs_mapping: 'IAS 16', statement_section: 'ASSETS_NON_CURRENT', opening_balance: -200, closing_balance: -350, period_name: '2026-01' },
      // Cash
      { account_id: 'a-cash', account_code: '1000', account_name: 'Cash at Bank', account_category: 'CURRENT_ASSET', ifrs_mapping: 'IAS 7', statement_section: 'ASSETS_CURRENT', opening_balance: 500, closing_balance: 700, period_name: '2026-01' },
      // Receivables
      { account_id: 'a-ar', account_code: '1100', account_name: 'Trade Receivables', account_category: 'CURRENT_ASSET', ifrs_mapping: 'IFRS 9', statement_section: 'ASSETS_CURRENT', opening_balance: 300, closing_balance: 250, period_name: '2026-01' },
      // Residual current asset (no keyword match -> otherCurrentAssets)
      { account_id: 'a-misc', account_code: '1200', account_name: 'Sundry Current Asset', account_category: 'CURRENT_ASSET', ifrs_mapping: null, statement_section: 'ASSETS_CURRENT', opening_balance: 50, closing_balance: 60, period_name: '2026-01' },
      // Genuinely unclassifiable non-current asset (no residual bucket exists for this)
      { account_id: 'a-weird', account_code: '1900', account_name: 'Unmapped Long-Term Asset', account_category: 'NON_CURRENT_ASSET', ifrs_mapping: null, statement_section: 'ASSETS_NON_CURRENT', opening_balance: 10, closing_balance: 10, period_name: '2026-01' },
      // Payables
      { account_id: 'a-ap', account_code: '2000', account_name: 'Trade Payables', account_category: 'CURRENT_LIABILITY', ifrs_mapping: null, statement_section: 'LIABILITIES_CURRENT', opening_balance: 400, closing_balance: 380, period_name: '2026-01' },
      // Share capital + premium split
      { account_id: 'a-shcap', account_code: '3000', account_name: 'Ordinary Share Capital', account_category: 'SHARE_CAPITAL', ifrs_mapping: null, statement_section: 'EQUITY', opening_balance: 1000, closing_balance: 1000, period_name: '2026-01' },
      { account_id: 'a-shprem', account_code: '3001', account_name: 'Share Premium', account_category: 'SHARE_CAPITAL', ifrs_mapping: null, statement_section: 'EQUITY', opening_balance: 200, closing_balance: 200, period_name: '2026-01' },
      { account_id: 'a-re', account_code: '3100', account_name: 'Retained Earnings', account_category: 'RETAINED_EARNINGS', ifrs_mapping: null, statement_section: 'EQUITY', opening_balance: 40, closing_balance: 90, period_name: '2026-01' },
    ];

    const plRows = [
      { account_id: 'p-rev', account_code: '4000', account_name: 'Sales Revenue', statement_section: 'REVENUE', amount: 1000, period_name: '2026-01' },
      { account_id: 'p-cos', account_code: '5000', account_name: 'Cost of Sales', statement_section: 'COST_OF_SALES', amount: 400, period_name: '2026-01' },
      { account_id: 'p-opex', account_code: '6000', account_name: 'Admin Expenses', statement_section: 'OPERATING_EXPENSE', amount: 200, period_name: '2026-01' },
      { account_id: 'p-fin', account_code: '7000', account_name: 'Interest Expense', statement_section: 'FINANCE_EXPENSE', amount: 50, period_name: '2026-01' },
      { account_id: 'p-tax', account_code: '8000', account_name: 'Income Tax Expense', statement_section: 'TAX_EXPENSE', amount: 70, period_name: '2026-01' },
    ];

    /** Queues exactly the query sequence ifrsNotes() issues for ONE period:
     *  fetchSofpRows, fetchPlRows, then fetchSofpRows again (re-run inside
     *  buildFinancialPosition for the reconciliation cross-check) â€” see
     *  buildIfrsNotesForPeriod. Call twice (current + comparative) for a
     *  comparative-period test. */
    function queuePeriodQueries(mockFn: jest.Mock, sofp = sofpRows, pl = plRows) {
      mockFn.mockResolvedValueOnce(sofp).mockResolvedValueOnce(pl).mockResolvedValueOnce(sofp);
    }

    beforeEach(() => {
      prisma.ifrsNoteDisclosure = { findMany: jest.fn().mockResolvedValue([]) };
    });

    describe('note generation', () => {
      it('builds the PPE rollforward from the cost/accum-depreciation contra pair', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const ppe = (result.notes as any).propertyPlantEquipment.current as any;

        expect(ppe.openingCost).toBe(1000);
        expect(ppe.closingCost).toBe(1400);
        expect(ppe.netAdditionsAndDisposals).toBe(400); // 1400 - 1000
        expect(ppe.openingAccumulatedDepreciation).toBe(-200);
        expect(ppe.closingAccumulatedDepreciation).toBe(-350);
        expect(ppe.depreciationOrAmortisationChargeForYear).toBe(-150); // -350 - (-200)
        expect(ppe.netBookValueOpening).toBe(1200); // 1000 - (-200)
        expect(ppe.netBookValueClosing).toBe(1750); // 1400 - (-350)
      });

      it('splits SHARE_CAPITAL rows into shareCapital vs sharePremium by name', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const shareCapital = (result.notes as any).shareCapital.current as any;
        const sharePremium = (result.notes as any).sharePremium.current as any;

        expect(shareCapital.closingTotal).toBe(1000);
        expect(sharePremium.closingTotal).toBe(200);
      });

      it('routes an unmatched CURRENT_ASSET row into otherCurrentAssets', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const other = (result.notes as any).otherCurrentAssets.current as any;
        expect(other.accounts.map((a: any) => a.account_id)).toContain('a-misc');
      });

      it('builds P&L notes (Revenue, Cost of Sales, Operating Expenses, Finance Costs, Income Tax) from vw_statement_profit_loss', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        expect(((result.notes as any).revenueByCategory.current as any).total).toBe(1000);
        expect(((result.notes as any).costOfSales.current as any).total).toBe(400);
        expect(((result.notes as any).operatingExpenses.current as any).total).toBe(200);
        expect(((result.notes as any).financeCosts.current as any).total).toBe(50);
        expect(((result.notes as any).incomeTax.current as any).total).toBe(70);
      });

      it('includes all 21 GL-derived notes and all 7 narrative notes in one response', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        for (const key of ReportingService.IFRS_NOTE_KEYS) {
          expect(result.notes[key]).toBeDefined();
        }
      });
    });

    describe('comparative periods', () => {
      it('includes a comparative column on every GL-derived note when comparativeFiscalPeriodId is supplied', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw, sofpRows, plRows); // current
        queuePeriodQueries(prisma.$queryRaw, sofpRows, plRows); // comparative

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-2', 'fp-1');
        expect(result.comparativeFiscalPeriodId).toBe('fp-1');
        expect(((result.notes as any).cashAndCashEquivalents as any).current).toBeDefined();
        expect(((result.notes as any).cashAndCashEquivalents as any).comparative).toBeDefined();
      });

      it('omits the comparative key on GL-derived notes when no comparative period is supplied', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        expect(((result.notes as any).cashAndCashEquivalents as any).comparative).toBeUndefined();
      });
    });

    describe('balance reconciliation', () => {
      it('flags assets/liabilities/equity as reconciling when the notes sum matches the Statement of Financial Position', async () => {
        prisma.$queryRaw = jest.fn();
        // Same rows used for buildIfrsNotesForPeriod's own SOFP/PL queries
        // AND the buildFinancialPosition cross-check re-query, so by
        // construction the two totals agree here.
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        expect(result.reconciliation.assetsReconcileToStatementOfFinancialPosition).toBe(true);
        expect(result.reconciliation.liabilitiesReconcileToStatementOfFinancialPosition).toBe(true);
        expect(result.reconciliation.equityReconcilesToStatementOfFinancialPosition).toBe(true);
      });

      it('surfaces genuinely unclassifiable accounts instead of silently dropping them', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const unclassifiedIds = result.reconciliation.unclassifiedSofpAccounts.map((a: any) => a.account_id);
        expect(unclassifiedIds).toContain('a-weird');
      });
    });

    describe('missing account handling', () => {
      it('returns a zero-value note rather than throwing when an entity has no accounts for a given note', async () => {
        prisma.$queryRaw = jest.fn();
        // No PPE, no investment property, no leases at all for this entity
        const sparseRows = [
          { account_id: 'a-cash', account_code: '1000', account_name: 'Cash', account_category: 'CURRENT_ASSET', ifrs_mapping: null, statement_section: 'ASSETS_CURRENT', opening_balance: 100, closing_balance: 100, period_name: '2026-01' },
        ];
        queuePeriodQueries(prisma.$queryRaw, sparseRows, []);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const ppe = (result.notes as any).propertyPlantEquipment.current as any;
        expect(ppe.accounts).toEqual([]);
        expect(ppe.netBookValueClosing).toBe(0);
        expect((result.notes as any).investmentProperty.current).toBeDefined();
      });

      it('rejects an unknown note key via ifrsNote() rather than returning undefined', async () => {
        prisma.$queryRaw = jest.fn().mockResolvedValue([]);
        await expect(service.ifrsNote(scope, 'ent-1', 'notARealNote', 'fp-1')).rejects.toThrow(NotFoundException);
      });
    });

    describe('multi-entity reporting', () => {
      it('returns notes for every accessible entity and lists denied ones separately, rather than failing the whole batch', async () => {
        const restrictedScope: SecurityScope = {
          ...scope,
          isSystemAdmin: false,
          entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        };
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw); // only ent-1 is queried; ent-2 is denied before any query

        const result = await service.ifrsNotesForEntities(restrictedScope, ['ent-1', 'ent-2'], 'fp-1');
        expect(Object.keys(result.entities)).toEqual(['ent-1']);
        expect(result.deniedEntityIds).toEqual(['ent-2']);
      });
    });

    describe('consolidated reporting (deliberately out of scope â€” see reporting.service.ts header comment)', () => {
      it('ifrsNotesForEntities returns each entity\'s own unconsolidated figures, not an eliminated group total', async () => {
        // Two entities with intercompany-style balances that would net to
        // zero under a real consolidation; ifrsNotesForEntities does NOT
        // attempt that netting (see the Phase 3C header comment on why),
        // so both entities' raw figures should come back independently.
        const unrestricted = buildUnrestrictedScope();
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw, sofpRows, plRows); // ent-1
        queuePeriodQueries(prisma.$queryRaw, sofpRows, plRows); // ent-2

        const result = await service.ifrsNotesForEntities(unrestricted, ['ent-1', 'ent-2'], 'fp-1');
        expect((result.entities['ent-1'] as any).notes.cashAndCashEquivalents.current.closingTotal).toBe(700);
        expect((result.entities['ent-2'] as any).notes.cashAndCashEquivalents.current.closingTotal).toBe(700);
        // i.e. NOT eliminated/netted down to a single group figure.
      });
    });

    describe('permission enforcement', () => {
      it('rejects ifrsNotes for an entity outside the caller\'s RLS scope', async () => {
        const restrictedScope: SecurityScope = {
          ...scope,
          isSystemAdmin: false,
          entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        };
        prisma.$queryRaw = jest.fn();
        await expect(service.ifrsNotes(restrictedScope, 'ent-2', 'fp-1')).rejects.toThrow(ForbiddenException);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('rejects the narrative-disclosure write for an entity outside the caller\'s RLS scope', async () => {
        const restrictedScope: SecurityScope = {
          ...scope,
          isSystemAdmin: false,
          entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        };
        await expect(
          service.upsertIfrsNarrativeDisclosure(restrictedScope, 'ent-2', 'fp-1', 'subsequentEvents', 'text', 'user-1'),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('narrative disclosures', () => {
      it('reports isSet=false and content=null for a note that has never been entered', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);
        prisma.ifrsNoteDisclosure.findMany.mockResolvedValue([]);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const note = (result.notes as any).subsequentEvents as any;
        expect(note.isSet).toBe(false);
        expect(note.content).toBeNull();
      });

      it('surfaces previously-entered narrative content', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);
        prisma.ifrsNoteDisclosure.findMany.mockResolvedValue([
          { noteType: 'SUBSEQUENT_EVENTS', content: 'No subsequent events noted.', updatedAt: new Date('2026-01-15') },
        ]);

        const result = await service.ifrsNotes(scope, 'ent-1', 'fp-1');
        const note = (result.notes as any).subsequentEvents as any;
        expect(note.isSet).toBe(true);
        expect(note.content).toBe('No subsequent events noted.');
      });

      it('upserts a narrative disclosure keyed by (entity, fiscalPeriod, noteType)', async () => {
        prisma.ifrsNoteDisclosure.upsert = jest.fn().mockResolvedValue({ id: 'note-1' });
        await service.upsertIfrsNarrativeDisclosure(scope, 'ent-1', 'fp-1', 'commitments', 'No material commitments.', 'user-1');

        expect(prisma.ifrsNoteDisclosure.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { entityId_fiscalPeriodId_noteType: { entityId: 'ent-1', fiscalPeriodId: 'fp-1', noteType: 'COMMITMENTS' } },
          }),
        );
      });
    });

    describe('export formats', () => {
      it('pdf-ready returns the same nested shape as ifrsNotes()', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);
        const result: any = await service.ifrsNotesExport(scope, 'ent-1', 'fp-1', 'pdf-ready');
        expect(result.notes).toBeDefined();
      });

      it('excel-ready/powerbi return a flat array of (note, period, account) rows suitable for pivoting', async () => {
        prisma.$queryRaw = jest.fn();
        queuePeriodQueries(prisma.$queryRaw);
        const result: any = await service.ifrsNotesExport(scope, 'ent-1', 'fp-1', 'excel-ready');
        expect(Array.isArray(result.rows)).toBe(true);
        expect(result.rows.some((r: any) => r.noteKey === 'cashAndCashEquivalents' && r.amount === 700)).toBe(true);
      });
    });

    describe('regression against existing financial statements', () => {
      it('statementOfFinancialPosition still works correctly through the refactored fetchSofpRows helper', async () => {
        prisma.$queryRaw = jest.fn().mockResolvedValue(sofpRows);
        const { current } = await service.statementOfFinancialPosition(scope, 'ent-1', 'fp-1');
        // Same figures the pre-Phase-3C implementation would have produced
        // (opening/ifrs_mapping/account_category were added to the row
        // interface, not to the query or the aggregation logic).
        expect(current.totalCurrentAssets).toBe(700 + 250 + 60); // cash + AR + misc
      });

      it('statementOfProfitOrLoss still works correctly through the refactored fetchPlRows helper', async () => {
        prisma.$queryRaw = jest.fn().mockResolvedValue(plRows);
        const { current } = await service.statementOfProfitOrLoss(scope, 'ent-1', 'fp-1');
        expect(current.totalRevenue).toBe(1000);
        expect(current.netProfit).toBe(280); // 1000 - 400 - 200 - 50 - 70
      });
    });
  });
});

describe('ReportingService.crmPipeline (Release â€” CRM Reporting Integration)', () => {
  let service: ReportingService;
  let prisma: any;

  const scope = {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: { unrestricted: true, viewableIds: [], postableIds: [] },
    department: { unrestricted: true, viewableIds: [], postableIds: [] },
    costCenter: { unrestricted: true, viewableIds: [], postableIds: [] },
    project: { unrestricted: true, viewableIds: [], postableIds: [] },
    businessUnit: { unrestricted: true, viewableIds: [], postableIds: [] },
  } as unknown as SecurityScope;

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportingService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchedulingService, useValue: { getGanttData: jest.fn(), computeEarnedValue: jest.fn() } },
        { provide: RiskIssueService, useValue: { getRiskIssueSummary: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ReportingService);
  });

  it('summarises the lead funnel and prospect pipeline from vw_crm_pipeline', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { lead_id: 'l1', lead_status: 'CONVERTED', source: 'REFERRAL', prospect_id: 'p1', prospect_status: 'WON', budget_min: 100, budget_max: 150, days_in_pipeline: 10 },
      { lead_id: 'l2', lead_status: 'DISQUALIFIED', source: 'WEBSITE', prospect_id: null, prospect_status: null, budget_min: null, budget_max: null, days_in_pipeline: 5 },
      { lead_id: 'l3', lead_status: 'CONTACTED', source: 'WEBSITE', prospect_id: null, prospect_status: null, budget_min: null, budget_max: null, days_in_pipeline: 3 },
      { lead_id: 'l4', lead_status: 'QUALIFIED', source: 'AGENT', prospect_id: 'p4', prospect_status: 'NEGOTIATING', budget_min: 200, budget_max: 300, days_in_pipeline: 2 },
    ]);

    const result = await service.crmPipeline(scope, 'ent-1');

    expect(result.totalLeads).toBe(4);
    expect(result.leadsByStatus).toEqual({ CONVERTED: 1, DISQUALIFIED: 1, CONTACTED: 1, QUALIFIED: 1 });
    expect(result.leadConversionRate).toBe(0.5); // 1 CONVERTED / (1 CONVERTED + 1 DISQUALIFIED)
    expect(result.totalProspects).toBe(2);
    expect(result.activePipelineValue).toBe(300); // only the NEGOTIATING (still-open) prospect's budgetMax
    expect(result.averageDaysToWin).toBe(10); // only the WON prospect
  });

  it('reports null conversion rate / average-days-to-win when nothing is closed/won yet', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { lead_id: 'l1', lead_status: 'NEW', source: 'WALK_IN', prospect_id: null, prospect_status: null, budget_min: null, budget_max: null, days_in_pipeline: 1 },
    ]);

    const result = await service.crmPipeline(scope, 'ent-1');
    expect(result.leadConversionRate).toBeNull();
    expect(result.averageDaysToWin).toBeNull();
  });
});

describe('ReportingService PMO methods (Release K â€” PMO Reporting Integration)', () => {
  let service: ReportingService;
  let prisma: any;
  let scheduling: any;
  let riskIssue: any;

  const scope: SecurityScope = {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: { unrestricted: true, viewableIds: [], postableIds: [] },
    department: { unrestricted: true, viewableIds: [], postableIds: [] },
    costCenter: { unrestricted: true, viewableIds: [], postableIds: [] },
    project: { unrestricted: true, viewableIds: [], postableIds: [] },
    businessUnit: { unrestricted: true, viewableIds: [], postableIds: [] },
  };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    scheduling = { getGanttData: jest.fn(), computeEarnedValue: jest.fn() };
    riskIssue = { getRiskIssueSummary: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportingService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchedulingService, useValue: scheduling },
        { provide: RiskIssueService, useValue: riskIssue },
      ],
    }).compile();
    service = moduleRef.get(ReportingService);
  });

  it('pmoProjectPerformance delegates to SchedulingService with the entityId filter and combines both results', async () => {
    scheduling.getGanttData.mockResolvedValue({ tasks: [{ id: 't1' }], dependencies: [] });
    scheduling.computeEarnedValue.mockResolvedValue({ PV: 100, EV: 80, AC: 90, SPI: 0.8, CPI: 0.89 });

    const result = await service.pmoProjectPerformance(scope, 'ent-1', 'proj-1');

    expect(scheduling.getGanttData).toHaveBeenCalledWith('proj-1', 'ent-1');
    expect(scheduling.computeEarnedValue).toHaveBeenCalledWith('proj-1', undefined, 'ent-1');
    expect(result.schedule.tasks).toHaveLength(1);
    expect(result.earnedValue.SPI).toBe(0.8);
  });

  it('pmoProjectPerformance never calls SchedulingService.computeCriticalPath (read-only report, no side effects)', async () => {
    scheduling.getGanttData.mockResolvedValue({ tasks: [], dependencies: [] });
    scheduling.computeEarnedValue.mockResolvedValue({ PV: 0, EV: 0, AC: 0, SPI: null, CPI: null });
    scheduling.computeCriticalPath = jest.fn();

    await service.pmoProjectPerformance(scope, 'ent-1', 'proj-1');

    expect(scheduling.computeCriticalPath).not.toHaveBeenCalled();
  });

  it('pmoRiskIssueRegister delegates to RiskIssueService with the entityId filter, projectId optional', async () => {
    riskIssue.getRiskIssueSummary.mockResolvedValue({ risksByStatus: [], topOpenRisks: [], issuesByStatus: [], openIssuesByPriority: [] });

    const result = await service.pmoRiskIssueRegister(scope, 'ent-1');

    expect(riskIssue.getRiskIssueSummary).toHaveBeenCalledWith(undefined, 'ent-1');
    expect(result.entityId).toBe('ent-1');
  });

  // Release IE.1, Checkpoint H â€” Payment Framework Reporting Integration
  it('paymentTransactionsRegister enforces RLS before querying the view', async () => {
    const restrictedScope: SecurityScope = {
      userId: 'user-2',
      isSystemAdmin: false,
      entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      department: { unrestricted: true, viewableIds: [], postableIds: [] },
      costCenter: { unrestricted: true, viewableIds: [], postableIds: [] },
      project: { unrestricted: true, viewableIds: [], postableIds: [] },
      businessUnit: { unrestricted: true, viewableIds: [], postableIds: [] },
    };

    await expect(service.paymentTransactionsRegister(restrictedScope, 'ent-2')).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    const result = await service.paymentTransactionsRegister(restrictedScope, 'ent-1');
    expect(result).toEqual([{ ok: true }]);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('paymentTransactionsRegister passes an optional status filter through to the query', async () => {
    const scope = buildUnrestrictedScope();
    await service.paymentTransactionsRegister(scope, 'ent-1', 'SUCCESSFUL');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

