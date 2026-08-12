import { PrismaClient, AccountType, AccountCategory, JournalEntryStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_ROLES, PERMISSIONS, STANDARD_ACCOUNT_CODES, encryptIntegrationCredentials } from '@7f/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 7F LedgerOS...');

  // ---------------------------------------------------------------
  // 1. Permissions & Roles
  // ---------------------------------------------------------------
  const allPermissionCodes = Object.values(PERMISSIONS);
  for (const code of allPermissionCodes) {
    const [module] = code.split('.');
    await prisma.permission.upsert({
      where: { code },
      create: { code, module: module.toUpperCase() },
      update: {},
    });
  }

  for (const roleDef of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      create: { code: roleDef.code, name: roleDef.name, isSystem: true },
      update: { name: roleDef.name },
    });

    for (const permCode of roleDef.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permCode } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log(`  âœ“ ${allPermissionCodes.length} permissions, ${DEFAULT_ROLES.length} roles`);

  // ---------------------------------------------------------------
  // 2. Admin user
  // ---------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash('ChangeMe!2026', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@7fifteencapital.com' },
    create: {
      email: 'admin@7fifteencapital.com',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
    },
    update: {},
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SYSTEM_ADMIN' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });
  console.log('  âœ“ admin user (admin@7fifteencapital.com / ChangeMe!2026 â€” rotate immediately)');

  // ---------------------------------------------------------------
  // 2b. Release K â€” default global password/lockout policy
  // ---------------------------------------------------------------
  // entityId: null = the global fallback PasswordPolicyService.getEffectivePolicy()
  // resolves to when no entity-specific AuthSecurityPolicy row exists. Values
  // match PasswordPolicyService's own hardcoded defaultPolicy() exactly, so
  // seeding this row changes nothing behaviorally â€” it just makes the policy
  // editable via GET/POST /security/password-policy instead of only existing
  // as a fallback constant.
  const existingGlobalPolicy = await prisma.authSecurityPolicy.findFirst({
    where: { entityId: null },
  });

  if (existingGlobalPolicy) {
    await prisma.authSecurityPolicy.update({
      where: { id: existingGlobalPolicy.id },
      data: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: false,
        expiryDays: null,
        historyCount: 5,
        maxFailedLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        isActive: true,
        createdById: admin.id,
      },
    });
  } else {
    await prisma.authSecurityPolicy.create({
      data: {
        entityId: null,
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: false,
        expiryDays: null,
        historyCount: 5,
        maxFailedLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        isActive: true,
        createdById: admin.id,
      },
    });
  }
  console.log('  âœ“ default global auth security policy (password + lockout)');

  // ---------------------------------------------------------------
  // 3. Entities
  // ---------------------------------------------------------------
  const parentCo = await prisma.entity.upsert({
    where: { code: '7FC' },
    create: {
      code: '7FC',
      name: '7Fifteen Capital Ltd',
      legalName: '7Fifteen Capital Ltd',
      baseCurrency: 'NGN',
      isConsolidationParent: true,
    },
    update: {},
  });

  const ikoyiDev = await prisma.entity.upsert({
    where: { code: '7FIL' },
    create: {
      code: '7FIL',
      name: '7F Ikoyi Development Ltd',
      legalName: '7F Ikoyi Development Ltd',
      baseCurrency: 'NGN',
      parentEntityId: parentCo.id,
    },
    update: {},
  });

  const zurii = await prisma.entity.upsert({
    where: { code: 'ZURII' },
    create: {
      code: 'ZURII',
      name: 'Zurii Residences',
      legalName: 'Zurii Residences Ltd',
      baseCurrency: 'NGN',
      parentEntityId: parentCo.id,
    },
    update: {},
  });
  console.log('  âœ“ entities: 7FC, 7FIL, ZURII');

  await prisma.userEntityAccess.upsert({
    where: { userId_entityId: { userId: admin.id, entityId: parentCo.id } },
    create: { userId: admin.id, entityId: parentCo.id, canPost: true, canView: true },
    update: {},
  });
  for (const entity of [ikoyiDev, zurii]) {
    await prisma.userEntityAccess.upsert({
      where: { userId_entityId: { userId: admin.id, entityId: entity.id } },
      create: { userId: admin.id, entityId: entity.id, canPost: true, canView: true },
      update: {},
    });
  }

  // ---------------------------------------------------------------
  // 4. Consolidation group
  // ---------------------------------------------------------------
  const group = await prisma.consolidationGroup.upsert({
    where: { code: '7FC-GROUP' },
    create: { code: '7FC-GROUP', name: '7Fifteen Capital Group', parentEntityId: parentCo.id },
    update: {},
  });
  for (const child of [ikoyiDev, zurii]) {
    const existing = await prisma.consolidationOwnership.findFirst({
      where: { consolidationGroupId: group.id, childEntityId: child.id },
    });
    if (!existing) {
      await prisma.consolidationOwnership.create({
        data: {
          consolidationGroupId: group.id,
          parentEntityId: parentCo.id,
          childEntityId: child.id,
          ownershipPercent: 100,
          effectiveFrom: new Date('2024-01-01'),
        },
      });
    }
  }
  console.log('  âœ“ consolidation group 7FC-GROUP (100% owned subsidiaries)');

  // ---------------------------------------------------------------
  // 5. Sample chart of accounts (group-wide)
  // ---------------------------------------------------------------
  const accountDefs: {
    code: string;
    name: string;
    accountType: AccountType;
    accountCategory: AccountCategory;
    ifrsMapping?: string;
  }[] = [
    { code: STANDARD_ACCOUNT_CODES.CASH_AND_BANK, name: 'Cash and Bank', accountType: 'ASSET', accountCategory: 'CURRENT_ASSET', ifrsMapping: 'IAS 1 - Current Assets' },
    { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, name: 'Accounts Receivable', accountType: 'ASSET', accountCategory: 'CURRENT_ASSET', ifrsMapping: 'IFRS 9 - Financial Assets' },
    { code: STANDARD_ACCOUNT_CODES.DUE_FROM_RELATED_PARTIES, name: 'Due from Related Parties', accountType: 'ASSET', accountCategory: 'CURRENT_ASSET', ifrsMapping: 'IAS 24 - Related Party Disclosures' },
    { code: STANDARD_ACCOUNT_CODES.PROPERTY_INVENTORY, name: 'Property Inventory', accountType: 'ASSET', accountCategory: 'CURRENT_ASSET', ifrsMapping: 'IAS 2 - Inventories' },
    { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE, name: 'Accounts Payable', accountType: 'LIABILITY', accountCategory: 'CURRENT_LIABILITY', ifrsMapping: 'IFRS 9 - Financial Liabilities' },
    { code: STANDARD_ACCOUNT_CODES.GOODS_RECEIVED_NOT_INVOICED, name: 'Goods Received Not Invoiced', accountType: 'LIABILITY', accountCategory: 'CURRENT_LIABILITY', ifrsMapping: 'IFRS 9 - Financial Liabilities' },
    { code: STANDARD_ACCOUNT_CODES.WHT_PAYABLE, name: 'Withholding Tax Payable', accountType: 'LIABILITY', accountCategory: 'CURRENT_LIABILITY' },
    { code: STANDARD_ACCOUNT_CODES.DUE_TO_RELATED_PARTIES, name: 'Due to Related Parties', accountType: 'LIABILITY', accountCategory: 'CURRENT_LIABILITY', ifrsMapping: 'IAS 24 - Related Party Disclosures' },
    { code: STANDARD_ACCOUNT_CODES.DEFERRED_REVENUE, name: 'Deferred Revenue', accountType: 'LIABILITY', accountCategory: 'CURRENT_LIABILITY', ifrsMapping: 'IFRS 15 - Revenue from Contracts with Customers' },
    { code: STANDARD_ACCOUNT_CODES.SHARE_CAPITAL, name: 'Share Capital', accountType: 'EQUITY', accountCategory: 'SHARE_CAPITAL' },
    { code: STANDARD_ACCOUNT_CODES.SHARE_PREMIUM, name: 'Share Premium', accountType: 'EQUITY', accountCategory: 'SHARE_CAPITAL', ifrsMapping: 'IAS 1 - Share Premium' },
    { code: STANDARD_ACCOUNT_CODES.RETAINED_EARNINGS, name: 'Retained Earnings', accountType: 'EQUITY', accountCategory: 'RETAINED_EARNINGS' },
    { code: STANDARD_ACCOUNT_CODES.DIVIDENDS_DECLARED, name: 'Dividends Declared', accountType: 'EQUITY', accountCategory: 'RETAINED_EARNINGS', ifrsMapping: 'IAS 1 - Dividends Declared' },
    { code: STANDARD_ACCOUNT_CODES.REVALUATION_RESERVE, name: 'Revaluation Reserve', accountType: 'EQUITY', accountCategory: 'OTHER_EQUITY', ifrsMapping: 'IAS 16 - Revaluation Surplus' },
    { code: STANDARD_ACCOUNT_CODES.FOREIGN_CURRENCY_TRANSLATION_RESERVE, name: 'Foreign Currency Translation Reserve', accountType: 'EQUITY', accountCategory: 'OTHER_EQUITY', ifrsMapping: 'IAS 21 - Foreign Currency Translation Reserve' },
    { code: STANDARD_ACCOUNT_CODES.OTHER_EQUITY_RESERVES, name: 'Other Equity Reserves', accountType: 'EQUITY', accountCategory: 'OTHER_EQUITY', ifrsMapping: 'IAS 1 - Other Reserves' },
    { code: STANDARD_ACCOUNT_CODES.PROPERTY_SALES_REVENUE, name: 'Property Sales Revenue', accountType: 'REVENUE', accountCategory: 'OPERATING_REVENUE', ifrsMapping: 'IFRS 15 - Revenue from Contracts with Customers' },
    { code: STANDARD_ACCOUNT_CODES.OTHER_REVENUE, name: 'Other Revenue', accountType: 'REVENUE', accountCategory: 'OTHER_REVENUE' },
    { code: STANDARD_ACCOUNT_CODES.COST_OF_SALES, name: 'Cost of Sales', accountType: 'EXPENSE', accountCategory: 'COST_OF_SALES' },
    { code: STANDARD_ACCOUNT_CODES.OPERATING_EXPENSES, name: 'Operating Expenses', accountType: 'EXPENSE', accountCategory: 'OPERATING_EXPENSE' },
    // Release (Fixed Assets Core, additive)
    { code: STANDARD_ACCOUNT_CODES.FIXED_ASSETS, name: 'Fixed Assets â€” Property, Plant & Equipment', accountType: 'ASSET', accountCategory: 'NON_CURRENT_ASSET', ifrsMapping: 'IAS 16 - Property, Plant and Equipment' },
    { code: STANDARD_ACCOUNT_CODES.ACCUMULATED_DEPRECIATION, name: 'Accumulated Depreciation', accountType: 'ASSET', accountCategory: 'NON_CURRENT_ASSET', ifrsMapping: 'IAS 16 - Property, Plant and Equipment' },
    { code: STANDARD_ACCOUNT_CODES.DEPRECIATION_EXPENSE, name: 'Depreciation Expense', accountType: 'EXPENSE', accountCategory: 'OPERATING_EXPENSE', ifrsMapping: 'IAS 16 - Property, Plant and Equipment' },
  ];

  const accountsByCode: Record<string, { id: string }> = {};
  for (const def of accountDefs) {
    const account = await prisma.account.upsert({
      where: { code: def.code },
      create: { ...def, isPostable: true },
      update: {},
    });
    accountsByCode[def.code] = account;

    // Activate every seeded account for every seeded entity.
    for (const entity of [parentCo, ikoyiDev, zurii]) {
      await prisma.entityAccount.upsert({
        where: { entityId_accountId: { entityId: entity.id, accountId: account.id } },
        create: { entityId: entity.id, accountId: account.id, isActive: true },
        update: {},
      });
    }
  }
  console.log(`  âœ“ ${accountDefs.length} group chart accounts, activated across all entities`);

  // ---------------------------------------------------------------
  // 5b. Fixed Assets Core: default category + one sample asset
  // ---------------------------------------------------------------
  const itEquipmentCategory = await prisma.assetCategory.upsert({
    where: { name: 'IT Equipment' },
    create: {
      name: 'IT Equipment',
      defaultUsefulLifeYears: 5,
      assetAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.FIXED_ASSETS].id,
      accumulatedDepreciationAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.ACCUMULATED_DEPRECIATION].id,
      depreciationExpenseAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.DEPRECIATION_EXPENSE].id,
    },
    update: {},
  });

  await prisma.fixedAsset.upsert({
    where: { entityId_assetTag: { entityId: parentCo.id, assetTag: '7FC-IT-0001' } },
    create: {
      entityId: parentCo.id,
      assetCategoryId: itEquipmentCategory.id,
      assetTag: '7FC-IT-0001',
      name: 'Head Office Server',
      acquisitionDate: new Date('2026-01-15'),
      acquisitionCost: 3_600_000,
      residualValue: 0,
      usefulLifeYears: 5,
    },
    update: {},
  });
  console.log('  âœ“ Fixed Assets Core: 1 asset category, 1 sample asset');

  // ---------------------------------------------------------------
  // 6. Real estate dimensions: project â†’ phase â†’ block â†’ floor â†’ unit
  // ---------------------------------------------------------------
  const project = await prisma.project.upsert({
    where: { entityId_code: { entityId: ikoyiDev.id, code: 'IKOYI-01' } },
    create: {
      entityId: ikoyiDev.id,
      code: 'IKOYI-01',
      name: 'Ikoyi Waterfront Development',
      description: 'Flagship residential development in Ikoyi',
    },
    update: {},
  });

  const phase = await prisma.phase.upsert({
    where: { projectId_code: { projectId: project.id, code: 'PH1' } },
    create: { projectId: project.id, code: 'PH1', name: 'Phase 1' },
    update: {},
  });

  const block = await prisma.block.upsert({
    where: { phaseId_code: { phaseId: phase.id, code: 'A' } },
    create: { phaseId: phase.id, code: 'A', name: 'Block A' },
    update: {},
  });

  const floor = await prisma.floor.upsert({
    where: { blockId_code: { blockId: block.id, code: '3' } },
    create: { blockId: block.id, code: '3', name: 'Third Floor' },
    update: {},
  });

  const unit = await prisma.unit.upsert({
    where: { floorId_code: { floorId: floor.id, code: 'A-3-12' } },
    create: {
      floorId: floor.id,
      code: 'A-3-12',
      name: 'Unit A-3-12',
      unitType: '3-Bed Terrace',
      sizeSqm: 185.5,
      listPrice: 250_000_000,
      status: 'AVAILABLE',
    },
    update: {},
  });
  console.log('  âœ“ sample project tree: IKOYI-01 > PH1 > Block A > Floor 3 > Unit A-3-12');

  // ---------------------------------------------------------------
  // 7. Sample journal entries (illustrative, posted)
  // ---------------------------------------------------------------
  const existingSample = await prisma.journalEntry.findFirst({
    where: { entityId: parentCo.id, sourceReference: 'SEED-SAMPLE-001' },
  });

  if (!existingSample) {
    const fiscalPeriod = await prisma.fiscalPeriod.upsert({
      where: { entityId_name: { entityId: parentCo.id, name: '2026-07' } },
      create: {
        entityId: parentCo.id,
        name: '2026-07',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31T23:59:59'),
        status: 'OPEN',
      },
      update: {},
    });

    const entry = await prisma.journalEntry.create({
      data: {
        journalNumber: '7FC-JE-2026-000001',
        entityId: parentCo.id,
        fiscalPeriodId: fiscalPeriod.id,
        entryDate: new Date('2026-07-01'),
        description: 'Opening share capital injection',
        sourceType: 'MANUAL',
        sourceReference: 'SEED-SAMPLE-001',
        status: JournalEntryStatus.POSTED,
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
        postedById: admin.id,
        postedAt: new Date(),
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: accountsByCode[STANDARD_ACCOUNT_CODES.CASH_AND_BANK].id,
              debit: 500_000_000,
              credit: 0,
              entityId: parentCo.id,
              memo: 'Founding capital received',
            },
            {
              lineNumber: 2,
              accountId: accountsByCode[STANDARD_ACCOUNT_CODES.SHARE_CAPITAL].id,
              debit: 0,
              credit: 500_000_000,
              entityId: parentCo.id,
              memo: 'Founding capital issued',
            },
          ],
        },
      },
    });

    await prisma.journalNumberSequence.upsert({
      where: { entityId_fiscalYear: { entityId: parentCo.id, fiscalYear: 2026 } },
      create: { entityId: parentCo.id, fiscalYear: 2026, lastNumber: 1 },
      update: { lastNumber: 1 },
    });

    console.log(`  âœ“ sample posted journal entry ${entry.journalNumber}`);
  } else {
    console.log('  âœ“ sample journal entry already present, skipped');
  }

  const sampleCashLine = await prisma.journalLine.findFirstOrThrow({
    where: {
      entityId: parentCo.id,
      accountId: accountsByCode[STANDARD_ACCOUNT_CODES.CASH_AND_BANK].id,
      journalEntry: { sourceReference: 'SEED-SAMPLE-001' },
    },
  });

  // ---------------------------------------------------------------
  // 8. Budgeting: FY2026 approved project budget
  // ---------------------------------------------------------------
  await seedBudget({
    entityId: ikoyiDev.id,
    projectId: project.id,
    phaseId: phase.id,
    costOfSalesAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.COST_OF_SALES].id,
    opexAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.OPERATING_EXPENSES].id,
    adminUserId: admin.id,
  });

  // ---------------------------------------------------------------
  // 9. Vendor, customer, warehouse, and bank account masters
  // ---------------------------------------------------------------
  const vendor = await prisma.vendor.upsert({
    where: { code: 'VEND-APEX-SEC' },
    create: {
      code: 'VEND-APEX-SEC',
      name: 'Apex Site Security Services Ltd',
      taxId: 'TIN-10234567',
      bankName: 'Zenith Bank',
      bankAccountNumber: '2033445566',
    },
    update: {},
  });

  const customer = await prisma.customer.upsert({
    where: { code: 'CUST-0001' },
    create: { code: 'CUST-0001', name: 'Adaeze Nwosu', email: 'adaeze.nwosu@example.com', phone: '+234-801-000-0001' },
    update: {},
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { entityId_code: { entityId: ikoyiDev.id, code: 'HO' } },
    create: { entityId: ikoyiDev.id, code: 'HO', name: 'Head Office / Services' },
    update: {},
  });

  const bankAccount = await prisma.bankAccount.upsert({
    where: { entityId_accountNumber: { entityId: parentCo.id, accountNumber: '1122334455' } },
    create: {
      entityId: parentCo.id,
      accountName: '7Fifteen Capital â€” Operating Account',
      accountNumber: '1122334455',
      bankName: 'Guaranty Trust Bank',
      currency: 'NGN',
    },
    update: {},
  });
  console.log('  âœ“ vendor, customer, warehouse, and bank account masters');

  // ---------------------------------------------------------------
  // 10. Procurement: PR -> approved PO (with BudgetCommitment) against
  //     the FY2026 opex budget line seeded above
  // ---------------------------------------------------------------
  await seedProcurement({
    entityId: ikoyiDev.id,
    projectId: project.id,
    phaseId: phase.id,
    opexAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.OPERATING_EXPENSES].id,
    grIrClearingAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.GOODS_RECEIVED_NOT_INVOICED].id,
    vendorId: vendor.id,
    warehouseId: warehouse.id,
    adminUserId: admin.id,
  });

  // ---------------------------------------------------------------
  // 11. Accounts Payable: a direct (non-PO) vendor invoice with WHT
  //     deducted at payment
  // ---------------------------------------------------------------
  await seedApInvoiceWithWht({
    entityId: ikoyiDev.id,
    vendorId: vendor.id,
    opexAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.OPERATING_EXPENSES].id,
    apControlAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE].id,
    whtPayableAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.WHT_PAYABLE].id,
    cashAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.CASH_AND_BANK].id,
    bankAccountId: bankAccount.id,
    adminUserId: admin.id,
  });

  // ---------------------------------------------------------------
  // 12. Accounts Receivable: customer installment plan on the seeded
  //     unit, reusing Real Estate's InstallmentSchedule/InstallmentLine
  // ---------------------------------------------------------------
  await seedCustomerInstallmentPlan({ unitId: unit.id, customerId: customer.id });

  // ---------------------------------------------------------------
  // 13. Bank statement + reconciliation session (one line matched to
  //     the sample share-capital deposit above, one left open)
  // ---------------------------------------------------------------
  await seedBankReconciliation({
    entityId: parentCo.id,
    bankAccountId: bankAccount.id,
    bankGlAccountId: accountsByCode[STANDARD_ACCOUNT_CODES.CASH_AND_BANK].id,
    matchedJournalLineId: sampleCashLine.id,
    adminUserId: admin.id,
  });

  // ---------------------------------------------------------------
  // 14. Integration Framework: a sample EMAIL/SMTP provider row
  //     (Release IC.1). entityId is left null â€” a company-wide SMTP
  //     relay, not tied to one legal entity, same reasoning as
  //     IntegrationProvider.entityId's doc comment. Credentials are
  //     encrypted the same way IntegrationsService.createProvider does
  //     (this script isn't a NestJS context, so it calls the shared
  //     @7f/config function directly rather than duplicating the
  //     AES-256-GCM logic here).
  // ---------------------------------------------------------------
  const existingSmtpProvider = await prisma.integrationProvider.findFirst({
    where: { category: 'EMAIL', providerCode: 'SMTP', entityId: null },
  });
  if (!existingSmtpProvider) {
    await prisma.integrationProvider.create({
      data: {
        category: 'EMAIL',
        providerCode: 'SMTP',
        name: 'Company SMTP Relay',
        config: { host: 'smtp.sendgrid.net', port: 587, secure: false, fromAddress: 'no-reply@7fifteencapital.com' },
        encryptedCredentials: encryptIntegrationCredentials({ user: 'apikey', password: 'CHANGE_ME_IN_PRODUCTION' }),
        createdById: admin.id,
      },
    });
    console.log('  âœ“ integration provider: EMAIL/SMTP (Company SMTP Relay) â€” set EMAIL_SMTP_PROVIDER_ID to its id to use it instead of raw SMTP_* env vars');
  } else {
    console.log('  âœ“ integration provider EMAIL/SMTP already present, skipped');
  }

  // Release IC.2 â€” a sample EMAIL/MS_GRAPH_EMAIL provider row, same
  // pattern and reasoning as the SMTP one directly above. Only one of
  // the two EMAIL providers is actually used at a time â€” whichever id
  // EMAIL_SMTP_PROVIDER_ID points to (see MailService's doc comment).
  const existingGraphProvider = await prisma.integrationProvider.findFirst({
    where: { category: 'EMAIL', providerCode: 'MS_GRAPH_EMAIL', entityId: null },
  });
  if (!existingGraphProvider) {
    await prisma.integrationProvider.create({
      data: {
        category: 'EMAIL',
        providerCode: 'MS_GRAPH_EMAIL',
        name: 'Microsoft 365 Mail (Graph API)',
        config: { tenantId: 'CHANGE_ME_TENANT_ID', clientId: 'CHANGE_ME_CLIENT_ID', senderUserId: 'no-reply@7fifteencapital.com' },
        encryptedCredentials: encryptIntegrationCredentials({ clientSecret: 'CHANGE_ME_IN_PRODUCTION' }),
        createdById: admin.id,
      },
    });
    console.log('  âœ“ integration provider: EMAIL/MS_GRAPH_EMAIL (Microsoft 365 Mail) â€” set EMAIL_SMTP_PROVIDER_ID to its id to use it instead of SMTP');
  } else {
    console.log('  âœ“ integration provider EMAIL/MS_GRAPH_EMAIL already present, skipped');
  }

  // Release IC.3 â€” a sample EMAIL/GMAIL_EMAIL provider row, same pattern
  // as SMTP/MS_GRAPH_EMAIL above. No senderUserId field (unlike Graph) â€”
  // see google.ts's doc comment for why: the mailbox is whichever
  // account granted the refresh token, not something configured here.
  const existingGmailProvider = await prisma.integrationProvider.findFirst({
    where: { category: 'EMAIL', providerCode: 'GMAIL_EMAIL', entityId: null },
  });
  if (!existingGmailProvider) {
    await prisma.integrationProvider.create({
      data: {
        category: 'EMAIL',
        providerCode: 'GMAIL_EMAIL',
        name: 'Gmail (Google Workspace)',
        config: { clientId: 'CHANGE_ME_CLIENT_ID' },
        encryptedCredentials: encryptIntegrationCredentials({ clientSecret: 'CHANGE_ME_IN_PRODUCTION', refreshToken: 'CHANGE_ME_IN_PRODUCTION' }),
        createdById: admin.id,
      },
    });
    console.log('  âœ“ integration provider: EMAIL/GMAIL_EMAIL (Gmail) â€” set EMAIL_SMTP_PROVIDER_ID to its id to use it instead of SMTP/Graph');
  } else {
    console.log('  âœ“ integration provider EMAIL/GMAIL_EMAIL already present, skipped');
  }

  // Release IC.4 â€” a sample email template, so EmailTemplateService.render()
  // and NotificationsService.create({ templateCode: ... }) have something
  // real to exercise in a freshly-seeded environment. Same idempotent
  // find-then-create pattern as the integration providers above.
  const existingWelcomeTemplate = await prisma.emailTemplate.findUnique({ where: { code: 'WELCOME_EMAIL' } });
  if (!existingWelcomeTemplate) {
    await prisma.emailTemplate.create({
      data: {
        code: 'WELCOME_EMAIL',
        name: 'Welcome Email',
        description: 'Sent when a new user account is created.',
        subjectTemplate: 'Welcome to 7F LedgerOS, {{firstName}}!',
        htmlTemplate: '<p>Hi {{firstName}},</p><p>Your 7F LedgerOS account is ready. Your username is <strong>{{email}}</strong>.</p>',
        textTemplate: 'Hi {{firstName}}, your 7F LedgerOS account is ready. Your username is {{email}}.',
        variables: { firstName: 'Recipient first name', email: 'Recipient login email' },
        createdById: admin.id,
      },
    });
    console.log('  âœ“ email template: WELCOME_EMAIL');
  } else {
    console.log('  âœ“ email template WELCOME_EMAIL already present, skipped');
  }

  console.log('Seed complete.');
}

// ---------------------------------------------------------------
// 8. Budgeting: FY2026 approved project budget (helper, invoked from main)
// ---------------------------------------------------------------
async function seedBudget(params: {
  entityId: string;
  projectId: string;
  phaseId: string;
  costOfSalesAccountId: string;
  opexAccountId: string;
  adminUserId: string;
}) {
  const { entityId, projectId, phaseId, costOfSalesAccountId, opexAccountId, adminUserId } = params;

  const existing = await prisma.budget.findUnique({
    where: { entityId_code: { entityId, code: 'IKOYI-01-FY26' } },
  });
  if (existing) {
    console.log('  âœ“ FY2026 budget already present, skipped');
    return;
  }

  // One construction-cost line per month plus one opex line for the year,
  // enough to exercise variance/availability math against posted actuals.
  const constructionMonthly = 150_000_000;
  const lines = Array.from({ length: 12 }, (_, i) => ({
    accountId: costOfSalesAccountId,
    projectId,
    phaseId,
    period: i + 1,
    originalAmount: constructionMonthly,
    revisedAmount: constructionMonthly,
  })).concat([
    {
      accountId: opexAccountId,
      projectId,
      phaseId,
      period: 7,
      originalAmount: 20_000_000,
      revisedAmount: 20_000_000,
    },
  ]);

  const budget = await prisma.budget.create({
    data: {
      entityId,
      code: 'IKOYI-01-FY26',
      name: 'Ikoyi Waterfront Development â€” FY2026 Project Budget',
      fiscalYear: 2026,
      description: 'Construction cost and site opex envelope for IKOYI-01 Phase 1',
      status: 'APPROVED',
      createdById: adminUserId,
      submittedAt: new Date('2026-01-05'),
      approvedById: adminUserId,
      approvedAt: new Date('2026-01-10'),
      frozenAt: new Date('2026-01-10'),
      lines: { create: lines },
      approvals: {
        create: [
          { action: 'SUBMITTED', actorId: adminUserId, comments: 'Initial FY2026 submission' },
          { action: 'APPROVED', actorId: adminUserId, comments: 'Approved by Finance Controller' },
        ],
      },
    },
    include: { lines: true },
  });

  console.log(`  âœ“ FY2026 approved project budget ${budget.code} (${budget.lines.length} lines)`);
}

// ---------------------------------------------------------------
// Shared helper: posts a simple balanced journal entry directly
// (status POSTED), the same way the illustrative entry in main() does.
// Seed data has no Nest DI container to resolve PostingEngineService
// from, so this mirrors that service's essential behavior â€” atomic
// journal numbering, a FiscalPeriod, balanced lines â€” rather than
// re-deriving different logic.
// ---------------------------------------------------------------
async function postSeedJournalEntry(params: {
  entityId: string;
  entityCode: string;
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceReference: string;
  createdById: string;
  lines: { accountId: string; debit: number; credit: number; memo?: string; vendorId?: string; customerId?: string }[];
}) {
  const existing = await prisma.journalEntry.findFirst({
    where: { entityId: params.entityId, sourceReference: params.sourceReference },
  });
  if (existing) return existing;

  const year = params.entryDate.getUTCFullYear();
  const month = params.entryDate.getUTCMonth() + 1;
  const periodName = `${year}-${String(month).padStart(2, '0')}`;
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const fiscalPeriod = await prisma.fiscalPeriod.upsert({
    where: { entityId_name: { entityId: params.entityId, name: periodName } },
    create: { entityId: params.entityId, name: periodName, startDate: periodStart, endDate: periodEnd, status: 'OPEN' },
    update: {},
  });

  const sequence = await prisma.journalNumberSequence.upsert({
    where: { entityId_fiscalYear: { entityId: params.entityId, fiscalYear: year } },
    create: { entityId: params.entityId, fiscalYear: year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const journalNumber = `${params.entityCode}-JE-${year}-${String(sequence.lastNumber).padStart(6, '0')}`;

  return prisma.journalEntry.create({
    data: {
      journalNumber,
      entityId: params.entityId,
      fiscalPeriodId: fiscalPeriod.id,
      entryDate: params.entryDate,
      description: params.description,
      sourceType: params.sourceType as never,
      sourceReference: params.sourceReference,
      status: JournalEntryStatus.POSTED,
      createdById: params.createdById,
      approvedById: params.createdById,
      approvedAt: new Date(),
      postedById: params.createdById,
      postedAt: new Date(),
      lines: {
        create: params.lines.map((line, i) => ({
          lineNumber: i + 1,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
          vendorId: line.vendorId,
          customerId: line.customerId,
          entityId: params.entityId,
        })),
      },
    },
  });
}

// ---------------------------------------------------------------
// 10. Procurement: PR -> approved PO (BudgetCommitment) -> posted GRN
// ---------------------------------------------------------------
async function seedProcurement(params: {
  entityId: string;
  projectId: string;
  phaseId: string;
  opexAccountId: string;
  grIrClearingAccountId: string;
  vendorId: string;
  warehouseId: string;
  adminUserId: string;
}) {
  const existing = await prisma.purchaseRequisition.findUnique({
    where: { entityId_prNumber: { entityId: params.entityId, prNumber: 'PR-0001' } },
  });
  if (existing) {
    console.log('  âœ“ sample procurement PR/PO/GRN already present, skipped');
    return;
  }

  const budget = await prisma.budget.findUniqueOrThrow({
    where: { entityId_code: { entityId: params.entityId, code: 'IKOYI-01-FY26' } },
  });
  const budgetLine = await prisma.budgetLine.findFirstOrThrow({
    where: { budgetId: budget.id, accountId: params.opexAccountId, period: 7 },
  });

  const lineAmount = 5_000_000;

  const pr = await prisma.purchaseRequisition.create({
    data: {
      entityId: params.entityId,
      prNumber: 'PR-0001',
      requestedById: params.adminUserId,
      projectId: params.projectId,
      departmentId: null,
      justification: 'Site security services for Ikoyi Waterfront Phase 1',
      status: 'APPROVED',
      submittedAt: new Date('2026-07-02'),
      approvedById: params.adminUserId,
      approvedAt: new Date('2026-07-03'),
      lines: {
        create: [
          {
            description: 'Site security services â€” July 2026',
            accountId: params.opexAccountId,
            budgetLineId: budgetLine.id,
            quantity: 1,
            estimatedUnitCost: lineAmount,
            projectId: params.projectId,
            phaseId: params.phaseId,
          },
        ],
      },
    },
    include: { lines: true },
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      entityId: params.entityId,
      poNumber: 'PO-0001',
      requisitionId: pr.id,
      vendorId: params.vendorId,
      orderDate: new Date('2026-07-04'),
      status: 'APPROVED',
      createdById: params.adminUserId,
      approvedById: params.adminUserId,
      approvedAt: new Date('2026-07-05'),
      lines: {
        create: [
          {
            requisitionLineId: pr.lines[0].id,
            description: 'Site security services â€” July 2026',
            accountId: params.opexAccountId,
            budgetLineId: budgetLine.id,
            quantity: 1,
            unitCost: lineAmount,
            projectId: params.projectId,
            phaseId: params.phaseId,
          },
        ],
      },
    },
    include: { lines: true },
  });

  const commitment = await prisma.budgetCommitment.create({
    data: {
      budgetLineId: budgetLine.id,
      amount: lineAmount,
      sourceType: 'PURCHASE_ORDER',
      sourceId: po.lines[0].id,
      description: `PO ${po.poNumber} â€” Site security services`,
      createdById: params.adminUserId,
    },
  });
  await prisma.purchaseOrderLine.update({ where: { id: po.lines[0].id }, data: { budgetCommitmentId: commitment.id } });

  const grn = await prisma.procurementGRN.create({
    data: {
      entityId: params.entityId,
      grnNumber: 'GRN-0001',
      purchaseOrderId: po.id,
      vendorId: params.vendorId,
      warehouseId: params.warehouseId,
      receiptDate: new Date('2026-07-31'),
      grIrClearingAccountId: params.grIrClearingAccountId,
      status: 'POSTED',
      postedAt: new Date('2026-07-31'),
      createdById: params.adminUserId,
      lines: {
        create: [{ purchaseOrderLineId: po.lines[0].id, quantityReceived: 1, unitCost: lineAmount }],
      },
    },
  });

  await postSeedJournalEntry({
    entityId: params.entityId,
    entityCode: '7FIL',
    entryDate: new Date('2026-07-31'),
    description: `Goods receipt ${grn.grnNumber} â€” PO ${po.poNumber}`,
    sourceType: 'PROCUREMENT',
    sourceReference: `procurement-grn-${grn.id}`,
    createdById: params.adminUserId,
    lines: [
      { accountId: params.opexAccountId, debit: lineAmount, credit: 0, vendorId: params.vendorId },
      { accountId: params.grIrClearingAccountId, debit: 0, credit: lineAmount, vendorId: params.vendorId },
    ],
  });
  await prisma.budgetCommitment.update({
    where: { id: commitment.id },
    data: { releasedAmount: lineAmount, status: 'RELEASED' },
  });
  await prisma.purchaseOrderLine.update({ where: { id: po.lines[0].id }, data: { quantityReceived: 1 } });
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'FULLY_RECEIVED' } });

  console.log(`  âœ“ sample procurement: ${pr.prNumber} -> ${po.poNumber} -> ${grn.grnNumber} (â‚¦${lineAmount.toLocaleString()})`);
}

// ---------------------------------------------------------------
// 11. Accounts Payable: direct (non-PO) vendor invoice with WHT
//     deducted at payment
// ---------------------------------------------------------------
async function seedApInvoiceWithWht(params: {
  entityId: string;
  vendorId: string;
  opexAccountId: string;
  apControlAccountId: string;
  whtPayableAccountId: string;
  cashAccountId: string;
  bankAccountId: string;
  adminUserId: string;
}) {
  const existing = await prisma.vendorInvoice.findUnique({
    where: {
      entityId_vendorId_invoiceNumber: {
        entityId: params.entityId,
        vendorId: params.vendorId,
        invoiceNumber: 'APEX-INV-0042',
      },
    },
  });
  if (existing) {
    console.log('  âœ“ sample AP invoice with WHT already present, skipped');
    return;
  }

  const grossAmount = 2_000_000;
  const whtRate = 0.05;
  const whtAmount = grossAmount * whtRate;
  const netCash = grossAmount - whtAmount;

  const invoice = await prisma.vendorInvoice.create({
    data: {
      entityId: params.entityId,
      invoiceNumber: 'APEX-INV-0042',
      vendorId: params.vendorId,
      invoiceDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-31'),
      status: 'POSTED',
      postedAt: new Date('2026-08-01'),
      createdById: params.adminUserId,
      lines: {
        create: [
          { description: 'Consulting retainer â€” August 2026', accountId: params.opexAccountId, quantity: 1, unitCost: grossAmount },
        ],
      },
    },
  });

  await postSeedJournalEntry({
    entityId: params.entityId,
    entityCode: '7FIL',
    entryDate: invoice.invoiceDate,
    description: `AP invoice ${invoice.invoiceNumber}`,
    sourceType: 'ACCOUNTS_PAYABLE',
    sourceReference: `ap-invoice-${invoice.id}`,
    createdById: params.adminUserId,
    lines: [
      { accountId: params.opexAccountId, debit: grossAmount, credit: 0, vendorId: params.vendorId },
      { accountId: params.apControlAccountId, debit: 0, credit: grossAmount, vendorId: params.vendorId },
    ],
  });

  await prisma.vendorLedger.create({
    data: {
      entityId: params.entityId,
      vendorId: params.vendorId,
      transactionDate: invoice.invoiceDate,
      entryType: 'INVOICE',
      debit: 0,
      credit: grossAmount,
      description: `Invoice ${invoice.invoiceNumber}`,
      referenceType: 'VendorInvoice',
      referenceId: invoice.id,
    },
  });

  const voucher = await prisma.paymentVoucher.create({
    data: {
      entityId: params.entityId,
      voucherNumber: 'PV-0001',
      vendorId: params.vendorId,
      paymentDate: new Date('2026-08-20'),
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: params.bankAccountId,
      status: 'POSTED',
      postedAt: new Date('2026-08-20'),
      createdById: params.adminUserId,
      approvedById: params.adminUserId,
      approvedAt: new Date('2026-08-19'),
      allocations: {
        create: [
          {
            vendorInvoiceId: invoice.id,
            amountAllocated: grossAmount,
            whtDeduction: {
              create: {
                entityId: params.entityId,
                rate: whtRate,
                amount: whtAmount,
                taxAuthorityAccountId: params.whtPayableAccountId,
                status: 'PENDING',
              },
            },
          },
        ],
      },
    },
  });

  await postSeedJournalEntry({
    entityId: params.entityId,
    entityCode: '7FIL',
    entryDate: new Date('2026-08-20'),
    description: `Payment voucher ${voucher.voucherNumber}`,
    sourceType: 'ACCOUNTS_PAYABLE',
    sourceReference: `payment-voucher-${voucher.id}`,
    createdById: params.adminUserId,
    lines: [
      { accountId: params.apControlAccountId, debit: grossAmount, credit: 0, vendorId: params.vendorId },
      { accountId: params.cashAccountId, debit: 0, credit: netCash, vendorId: params.vendorId },
      { accountId: params.whtPayableAccountId, debit: 0, credit: whtAmount, vendorId: params.vendorId },
    ],
  });

  await prisma.vendorInvoice.update({ where: { id: invoice.id }, data: { amountPaid: grossAmount } });
  await prisma.vendorLedger.create({
    data: {
      entityId: params.entityId,
      vendorId: params.vendorId,
      transactionDate: new Date('2026-08-20'),
      entryType: 'PAYMENT',
      debit: grossAmount,
      credit: 0,
      description: `Payment voucher ${voucher.voucherNumber}`,
      referenceType: 'PaymentVoucher',
      referenceId: voucher.id,
    },
  });

  console.log(`  âœ“ sample AP invoice ${invoice.invoiceNumber} with 5% WHT, paid via ${voucher.voucherNumber}`);
}

// ---------------------------------------------------------------
// 12. Accounts Receivable: customer installment plan (reuses Real
//     Estate's InstallmentSchedule/InstallmentLine, per the AR-phase
//     decision to not fork a parallel model)
// ---------------------------------------------------------------
async function seedCustomerInstallmentPlan(params: { unitId: string; customerId: string }) {
  const existingAllocation = await prisma.unitSaleAllocation.findFirst({
    where: { unitId: params.unitId, customerId: params.customerId },
  });
  if (existingAllocation) {
    console.log('  âœ“ sample customer installment plan already present, skipped');
    return;
  }

  const salePrice = 250_000_000;
  const deposit = 50_000_000;
  const monthlyInstallment = (salePrice - deposit) / 8;

  const allocation = await prisma.unitSaleAllocation.create({
    data: {
      unitId: params.unitId,
      customerId: params.customerId,
      salePrice,
      allocationDate: new Date('2026-06-01'),
      status: 'RESERVED',
    },
  });

  const schedule = await prisma.installmentSchedule.create({
    data: {
      unitId: params.unitId,
      customerId: params.customerId,
      allocationId: allocation.id,
      totalAmount: salePrice,
      lines: {
        create: [
          { dueDate: new Date('2026-06-01'), amountDue: deposit, amountPaid: deposit, paidAt: new Date('2026-06-01') },
          ...Array.from({ length: 8 }, (_, i) => ({
            dueDate: new Date(Date.UTC(2026, 6 + i, 1)), // Jul 2026 .. Feb 2027
            amountDue: monthlyInstallment,
            amountPaid: 0,
          })),
        ],
      },
    },
    include: { lines: true },
  });

  console.log(`  âœ“ sample installment plan for unit A-3-12 (${schedule.lines.length} lines, deposit paid)`);
}

// ---------------------------------------------------------------
// 13. Bank statement + reconciliation session
// ---------------------------------------------------------------
async function seedBankReconciliation(params: {
  entityId: string;
  bankAccountId: string;
  bankGlAccountId: string;
  matchedJournalLineId: string;
  adminUserId: string;
}) {
  const existing = await prisma.bankStatement.findFirst({ where: { entityId: params.entityId, bankAccountId: params.bankAccountId } });
  if (existing) {
    console.log('  âœ“ sample bank statement/reconciliation session already present, skipped');
    return;
  }

  const statement = await prisma.bankStatement.create({
    data: {
      entityId: params.entityId,
      bankAccountId: params.bankAccountId,
      statementDate: new Date('2026-07-31'),
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-07-31'),
      openingBalance: 0,
      closingBalance: 500_000_000,
      importedById: params.adminUserId,
      lines: {
        create: [
          { transactionDate: new Date('2026-07-01'), description: 'Inbound transfer â€” share capital', amount: 500_000_000, isMatched: false },
          { transactionDate: new Date('2026-07-15'), description: 'Bank charges', amount: -7_500, isMatched: false },
        ],
      },
    },
    include: { lines: true },
  });

  const session = await prisma.reconciliationSession.create({
    data: {
      entityId: params.entityId,
      bankAccountId: params.bankAccountId,
      statementId: statement.id,
      bankGlAccountId: params.bankGlAccountId,
      sessionDate: new Date('2026-08-01'),
      status: 'DRAFT',
      createdById: params.adminUserId,
    },
  });

  const depositLine = statement.lines.find((l) => Number(l.amount) > 0)!;
  await prisma.reconciliationMatch.create({
    data: {
      sessionId: session.id,
      bankStatementLineId: depositLine.id,
      journalLineId: params.matchedJournalLineId,
      matchType: 'MANUAL',
      matchedAmount: Number(depositLine.amount),
      createdById: params.adminUserId,
    },
  });
  await prisma.bankStatementLine.update({ where: { id: depositLine.id }, data: { isMatched: true } });

  console.log(
    `  âœ“ sample bank statement + reconciliation session (1 line matched to opening capital, 1 bank-charge line left open for the adjustment workflow)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
