/**
 * Every permission code referenced by @RequirePermissions() decorators
 * across the API. Kept here so seed.ts and any future admin UI can stay
 * in sync with what controllers actually check.
 */
export const PERMISSIONS = {
  ENTITY_MANAGE: 'entity.manage',
  ENTITY_VIEW: 'entity.view',

  // Phase 2 — Row Level Security: Business Unit dimension (additive).
  BUSINESS_UNIT_MANAGE: 'businessunit.manage',
  BUSINESS_UNIT_VIEW: 'businessunit.view',

  COA_MANAGE: 'coa.manage',
  COA_VIEW: 'coa.view',

  DIMENSION_MANAGE: 'dimension.manage',
  DIMENSION_VIEW: 'dimension.view',

  GL_JOURNAL_CREATE: 'gl.journal.create',
  GL_JOURNAL_VIEW: 'gl.journal.view',
  GL_JOURNAL_APPROVE: 'gl.journal.approve',
  GL_JOURNAL_POST: 'gl.journal.post',
  GL_PERIOD_LOCK: 'gl.period.lock',
  GL_REPORTS_VIEW: 'gl.reports.view',

  INTERCOMPANY_CREATE: 'intercompany.create',
  INTERCOMPANY_VIEW: 'intercompany.view',
  INTERCOMPANY_RECONCILE: 'intercompany.reconcile',

  CONSOLIDATION_MANAGE: 'consolidation.manage',
  CONSOLIDATION_VIEW: 'consolidation.view',

  REALESTATE_MANAGE: 'realestate.manage',
  REALESTATE_VIEW: 'realestate.view',
  REALESTATE_SELL: 'realestate.sell',

  // Real Estate Customer Portal (additive) — gates a dedicated
  // customer-facing controller, the same "declared but not assigned to
  // any internal role" precedent CANDIDATE_PORTAL below already
  // establishes: wiring the actual external auth mechanism that grants
  // this permission is out of scope for the portal API itself.
  CUSTOMER_PORTAL: 'customer.portal',

  // Phase 5A — Land Bank (parcels, acquisition, titles, survey, plots)
  LANDBANK_MANAGE: 'landbank.manage',
  LANDBANK_VIEW: 'landbank.view',

  // Phase 5A — CRM / Lead Management / Prospects
  CRM_MANAGE: 'crm.manage',
  CRM_VIEW: 'crm.view',

  // Phase 5A — Mortgage Management
  MORTGAGE_MANAGE: 'mortgage.manage',
  MORTGAGE_VIEW: 'mortgage.view',

  // Phase 5A — Handover Workflow / Snag Lists / Defect Tracking
  HANDOVER_MANAGE: 'handover.manage',
  HANDOVER_VIEW: 'handover.view',

  // Phase 5A — Tenant / Lease Management
  LEASE_MANAGE: 'lease.manage',
  LEASE_VIEW: 'lease.view',

  // Phase 5A Release D — Facility Management / Maintenance Requests.
  // Bug fix: facility.controller.ts already used the 'facility.*' /
  // 'maintenance.*' permission strings via @RequirePermissions(), but
  // they were never registered here. Since seed.ts only creates
  // Permission rows from Object.values(PERMISSIONS), those strings could
  // never be granted to any role — including SYSTEM_ADMIN — making every
  // Facility endpoint permanently inaccessible. This registers the codes
  // that were already in use; it does not change facility.controller.ts.
  FACILITY_MANAGE: 'facility.manage',
  FACILITY_VIEW: 'facility.view',
  MAINTENANCE_MANAGE: 'maintenance.manage',
  MAINTENANCE_VIEW: 'maintenance.view',

  REVENUE_RECOGNIZE: 'revenue.recognize',

  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_TRANSACT: 'inventory.transact',
  INVENTORY_POST: 'inventory.post',

  PMO_MANAGE: 'pmo.manage',
  PMO_VIEW: 'pmo.view',
  PMO_APPROVE: 'pmo.approve',

  TREASURY_MANAGE: 'treasury.manage',
  TREASURY_VIEW: 'treasury.view',
  TREASURY_TRANSACT: 'treasury.transact',

  // Release (Fixed Assets Core, additive)
  FIXEDASSET_MANAGE: 'fixedasset.manage',
  FIXEDASSET_VIEW: 'fixedasset.view',
  FIXEDASSET_DEPRECIATE: 'fixedasset.depreciate',
  FIXEDASSET_DISPOSE: 'fixedasset.dispose',

  // Release (Tax Center Core, additive)
  TAX_MANAGE: 'tax.manage',
  TAX_VIEW: 'tax.view',
  TAX_REMIT: 'tax.remit',

  // Release (Executive Reporting Core, additive)
  EXECUTIVE_VIEW: 'executive.view',

  HR_MANAGE: 'hr.manage',
  HR_VIEW: 'hr.view',
  HR_APPROVE: 'hr.approve',
  PAYROLL_MANAGE: 'payroll.manage',
  PAYROLL_APPROVE: 'payroll.approve',
  PAYROLL_POST: 'payroll.post',

  // Recruitment (dedicated module — requisitions, vacancies, candidates,
  // interviews, offers, background checks). These codes were referenced
  // by @RequirePermissions() in both ZIP A and ZIP B's recruitment
  // controllers but were never registered here, so no role -- including
  // SYSTEM_ADMIN -- could actually reach the recruitment module in either
  // branch as shipped. Added during harmonisation.
  RECRUITMENT_MANAGE: 'recruitment.manage',
  RECRUITMENT_VIEW: 'recruitment.view',
  // Narrower than RECRUITMENT_MANAGE: lets an assigned interview panelist
  // submit feedback without granting full requisition/offer/candidate
  // management rights. Referenced by InterviewController.submitFeedback()
  // but -- like the other recruitment codes above -- was never
  // registered in the catalogue in either source branch.
  RECRUITMENT_INTERVIEW: 'recruitment.interview',
  CANDIDATE_PORTAL: 'candidate.portal',

  HSE_MANAGE: 'hse.manage',
  HSE_VIEW: 'hse.view',
  HSE_REPORT: 'hse.report',

  BUDGET_MANAGE: 'budget.manage',
  BUDGET_VIEW: 'budget.view',
  BUDGET_SUBMIT: 'budget.submit',
  BUDGET_APPROVE: 'budget.approve',
  BUDGET_TRANSFER: 'budget.transfer',
  BUDGET_COMMIT: 'budget.commit',

  PROCUREMENT_MANAGE: 'procurement.manage',
  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_APPROVE: 'procurement.approve',
  PROCUREMENT_RECEIVE: 'procurement.receive',
  PROCUREMENT_MATCH: 'procurement.match',

  AP_MANAGE: 'ap.manage',
  AP_VIEW: 'ap.view',
  AP_APPROVE: 'ap.approve',
  AP_PAY: 'ap.pay',

  AR_MANAGE: 'ar.manage',
  AR_VIEW: 'ar.view',

  BANKRECON_MANAGE: 'bankrecon.manage',
  BANKRECON_VIEW: 'bankrecon.view',
  BANKRECON_APPROVE: 'bankrecon.approve',

  WORKFLOW_ADMIN: 'workflow.admin',
  WORKFLOW_MANAGE: 'workflow.manage',
  WORKFLOW_VIEW: 'workflow.view',
  WORKFLOW_ACT: 'workflow.act',

  ADMIN_BRANDING_MANAGE: 'admin.branding.manage',
  ADMIN_BRANDING_VIEW: 'admin.branding.view',
  ADMIN_TEMPLATES_MANAGE: 'admin.templates.manage',
  ADMIN_TEMPLATES_VIEW: 'admin.templates.view',

  FEATURE_FLAGS_MANAGE: 'admin.feature_flags.manage',
  FEATURE_FLAGS_VIEW: 'admin.feature_flags.view',
  JOB_RUNS_VIEW: 'admin.job_runs.view',

  // Release F — Notifications API. Reading/marking-read your OWN
  // notifications needs no special permission (just a valid JWT, same
  // as every other self-service surface in this codebase); this one
  // gates the cross-user delivery-stats admin/ops view only.
  NOTIFICATIONS_ADMIN_VIEW: 'notifications.admin.view',

  // Phase 2 — Row Level Security / dynamic dimension access admin.
  SECURITY_ACCESS_MANAGE: 'security.access.manage',
  SECURITY_ACCESS_VIEW: 'security.access.view',

  // Frontend Completion, FE-6 — Roles & Permissions administration
  // (viewing/creating roles, editing a role's permission set). Added
  // for this specific capability after confirming directly that no
  // existing code fits: SECURITY_ACCESS_* (immediately above) is for a
  // DIFFERENT feature — RLS dimension-access admin — not Role/Permission
  // CRUD, per its own comment. Included in SYSTEM_ADMIN's role
  // automatically (DEFAULT_ROLES below grants it every code via
  // `Object.values(PERMISSIONS)`); deliberately NOT added to any other
  // DEFAULT_ROLES entry — which non-SYSTEM_ADMIN roles should also
  // manage RBAC is a real product decision this checkpoint isn't in a
  // position to make unilaterally, so it's left to whoever seeds/edits
  // roles for a given deployment, not decided here.
  RBAC_VIEW: 'rbac.view',
  RBAC_MANAGE: 'rbac.manage',

  // Phase 2 — Field Level Security. Holding one of these unmasks the
  // corresponding sensitive field group wherever it appears (HR, payroll,
  // treasury, etc). See FieldMaskingInterceptor / SENSITIVE_FIELD_GROUPS.
  SECURITY_VIEW_SALARY: 'security.field.salary.view',
  SECURITY_VIEW_BANK_DETAILS: 'security.field.bank_details.view',
  SECURITY_VIEW_TAX_ID: 'security.field.tax_id.view',
  SECURITY_VIEW_PAYROLL_DETAIL: 'security.field.payroll_detail.view',
  SECURITY_VIEW_LOAN_VALUES: 'security.field.loan_values.view',
  SECURITY_VIEW_COST_RATES: 'security.field.cost_rates.view',
  SECURITY_VIEW_MEDICAL_RECORDS: 'security.field.medical_records.view',
  SECURITY_VIEW_EXEC_COMPENSATION: 'security.field.exec_compensation.view',
  SECURITY_VIEW_SENSITIVE_HR: 'security.field.sensitive_hr.view',

  // Release IA — Core Integration Framework (additive). Registering,
  // configuring, and health-checking third-party integration providers
  // (cloud storage, email, SMS/WhatsApp, payments, banking, etc. —
  // built out driver-by-driver in later releases on top of this
  // registry) is kept behind its own permission pair rather than an
  // existing admin.* code, since it grants the ability to see which
  // providers are configured and rotate their credentials.
  INTEGRATIONS_MANAGE: 'integrations.manage',
  INTEGRATIONS_VIEW: 'integrations.view',
  // Release IE.1, Checkpoint D — Payment Gateway Framework. Deliberately
  // its own permission pair rather than reusing INTEGRATIONS_MANAGE:
  // that one covers *configuring* a provider (API keys, health checks);
  // this one covers actually moving money (initializing a charge,
  // issuing a refund) against whichever provider is configured. A user
  // who can safely rotate a Paystack API key should not automatically be
  // able to refund a customer, and vice versa.
  PAYMENT_MANAGE: 'payments.manage',
  PAYMENT_VIEW: 'payments.view',
  // Release IE.1, Checkpoint E — deliberately separate from
  // PAYMENT_MANAGE (see ENTITY_UNRESTRICTED_PERMISSIONS in
  // security-context.service.ts): granted only to WORKER_SERVICE, so the
  // scheduled reconciliation job can call verify() across every
  // entity's stale transactions without requiring a per-entity
  // UserEntityAccess grant row per entity — while every human role
  // keeps PAYMENT_MANAGE's normal per-entity RLS scoping unchanged.
  PAYMENT_RECONCILE: 'payments.reconcile',

  // Release IF.1, Checkpoint C — Mono Connect account linking. Separate
  // from INTEGRATIONS_MANAGE for the same reason PAYMENT_MANAGE is: that
  // permission covers configuring the Mono integration itself (the
  // shared secret key); this one covers linking a specific customer's
  // real bank account to it via Mono Connect, which is a per-account
  // consent action, not an integration-configuration one.
  BANK_LINK_MANAGE: 'bank_link.manage',
  BANK_LINK_VIEW: 'bank_link.view',

  // Enterprise Banking APIs, Transfer APIs Checkpoint C — outbound bank
  // transfers. Separate from BANK_LINK_MANAGE/PAYMENT_MANAGE for the
  // same layering reason both of those already establish, but flagged
  // as the most sensitive of the three: this covers actually moving the
  // business's own money OUT to a third party, not linking a read-only
  // account view (BANK_LINK_MANAGE) or collecting an inbound customer
  // payment (PAYMENT_MANAGE). No approval-gate or transaction-limit
  // enforcement exists yet at this checkpoint (see
  // transfer-provider.interface.ts's own scope-decision note) — this
  // permission alone is the only gate right now, worth revisiting
  // alongside that still-open TransferPolicy question.
  BANK_TRANSFER_MANAGE: 'bank_transfer.manage',
  BANK_TRANSFER_VIEW: 'bank_transfer.view',

  // Release IG.1, Checkpoint C — Microsoft Graph Calendar. Separate from
  // INTEGRATIONS_MANAGE for the same reason BANK_LINK_MANAGE/PAYMENT_MANAGE
  // are: this covers creating/updating/cancelling a specific calendar
  // event, not configuring the underlying Graph integration itself.
  CALENDAR_MANAGE: 'calendar.manage',
  CALENDAR_VIEW: 'calendar.view',

  // Same reasoning as CALENDAR_MANAGE/VIEW above, for Contacts.
  CONTACTS_MANAGE: 'contacts.manage',
  CONTACTS_VIEW: 'contacts.view',

  // Release IG.1, Checkpoint M — Microsoft Graph Tasks. Same reasoning
  // as CALENDAR_MANAGE/CONTACTS_MANAGE above.
  TASKS_MANAGE: 'tasks.manage',
  TASKS_VIEW: 'tasks.view',

  // Release IG.1, Checkpoint S — Microsoft Graph Teams (online
  // meetings). Same reasoning as CALENDAR_MANAGE/CONTACTS_MANAGE/
  // TASKS_MANAGE above.
  TEAMS_MANAGE: 'teams.manage',
  TEAMS_VIEW: 'teams.view',

  // Release IG.1, Checkpoint P — Microsoft Graph Presence. No MANAGE
  // counterpart: unlike Calendar/Contacts/Tasks/Teams, PresenceProvider
  // (presence-provider.interface.ts) has a single read-only getPresence
  // method — there is nothing to "manage", only to view.
  PRESENCE_VIEW: 'presence.view',

  // Release IH, Checkpoint I — same naming convention as
  // CONTACTS_MANAGE/TASKS_MANAGE above.
  WORKSPACEADMIN_MANAGE: 'workspaceadmin.manage',
  WORKSPACEADMIN_VIEW: 'workspaceadmin.view',
  // Fixing a verified defect found during this checkpoint's audit:
  // SignaturesController (manual-envelope path, Checkpoint I) already
  // references 'signatures.manage'/'signatures.view' via
  // @RequirePermissions, but neither was ever registered here — meaning
  // no role could ever satisfy that guard. Same naming convention as
  // WORKSPACEADMIN_MANAGE/CONTACTS_MANAGE above.
  SIGNATURES_MANAGE: 'signatures.manage',
  SIGNATURES_VIEW: 'signatures.view',

  // Power BI. Same naming convention as CONTACTS_MANAGE/TASKS_MANAGE/
  // WORKSPACEADMIN_MANAGE above.
  POWER_BI_MANAGE: 'power_bi.manage',
  POWER_BI_VIEW: 'power_bi.view',

  // Fixing a second instance of the same verified-defect class this
  // codebase's own Signature Checkpoint K fix already found once:
  // ApiKeyController (API Gateway, Checkpoint A) already references
  // 'api_gateway.manage'/'api_gateway.view' via @RequirePermissions, but
  // neither was ever registered here — no role, including SYSTEM_ADMIN,
  // could ever satisfy that guard, making every /api-gateway/keys route
  // unreachable. Same naming convention as SIGNATURES_MANAGE/
  // WORKSPACEADMIN_MANAGE above.
  API_GATEWAY_MANAGE: 'api_gateway.manage',
  API_GATEWAY_VIEW: 'api_gateway.view',

  // Agent Management, RE-AGENT.1 (additive) — a real, standalone
  // external-sales-agent master, distinct from CRM_MANAGE/CRM_VIEW
  // above (which govern Lead/Prospect records, not Agent records).
  // Same naming convention as CRM_MANAGE/REALESTATE_MANAGE.
  AGENT_MANAGE: 'agent.manage',
  AGENT_VIEW: 'agent.view',

  // Commission Management, RE-COMM.1/RE-COMM.2 (additive) — verified
  // missing while adding COMMISSION_APPROVE below for RE-COMM.3:
  // CommissionPlanController and CommissionCalculationController have
  // both required 'commission.manage'/'commission.view' via
  // @RequirePermissions since RE-COMM.1, but neither code was ever
  // registered here, so no role — including SYSTEM_ADMIN — could ever
  // satisfy that guard, making every /commission-plans and
  // /commission-calculations route unreachable. Same defect class as
  // API_GATEWAY_MANAGE/SIGNATURES_MANAGE above, fixed the same way.
  COMMISSION_MANAGE: 'commission.manage',
  COMMISSION_VIEW: 'commission.view',
  // RE-COMM.3 (new) — deliberately separate from COMMISSION_MANAGE so
  // approval authority (PENDING -> APPROVED) can be granted to a
  // different, narrower set of roles than ordinary create/submit/cancel
  // authority — a real maker-checker control, not just a role check.
  // CommissionCalculationController's approve endpoint requires this
  // specifically, not COMMISSION_MANAGE.
  COMMISSION_APPROVE: 'commission.approve',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Default system roles and the permission codes each one grants. */
export const DEFAULT_ROLES: { code: string; name: string; permissions: PermissionCode[] }[] = [
  {
    code: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    permissions: Object.values(PERMISSIONS),
  },
  {
    code: 'FINANCE_CONTROLLER',
    name: 'Finance Controller',
    permissions: [
      PERMISSIONS.ENTITY_VIEW,
      PERMISSIONS.COA_MANAGE,
      PERMISSIONS.COA_VIEW,
      PERMISSIONS.DIMENSION_MANAGE,
      PERMISSIONS.DIMENSION_VIEW,
      PERMISSIONS.GL_JOURNAL_VIEW,
      PERMISSIONS.GL_JOURNAL_APPROVE,
      PERMISSIONS.GL_JOURNAL_POST,
      PERMISSIONS.GL_PERIOD_LOCK,
      PERMISSIONS.GL_REPORTS_VIEW,
      PERMISSIONS.INTERCOMPANY_VIEW,
      PERMISSIONS.INTERCOMPANY_RECONCILE,
      PERMISSIONS.CONSOLIDATION_MANAGE,
      PERMISSIONS.CONSOLIDATION_VIEW,
      PERMISSIONS.REALESTATE_MANAGE,
      PERMISSIONS.REALESTATE_VIEW,
      PERMISSIONS.REALESTATE_SELL,
      PERMISSIONS.LANDBANK_MANAGE,
      PERMISSIONS.LANDBANK_VIEW,
      PERMISSIONS.CRM_MANAGE,
      PERMISSIONS.CRM_VIEW,
      PERMISSIONS.MORTGAGE_MANAGE,
      PERMISSIONS.MORTGAGE_VIEW,
      PERMISSIONS.PAYMENT_MANAGE,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.HANDOVER_MANAGE,
      PERMISSIONS.HANDOVER_VIEW,
      PERMISSIONS.LEASE_MANAGE,
      PERMISSIONS.LEASE_VIEW,
      PERMISSIONS.FACILITY_MANAGE,
      PERMISSIONS.FACILITY_VIEW,
      PERMISSIONS.MAINTENANCE_MANAGE,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.REVENUE_RECOGNIZE,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_TRANSACT,
      PERMISSIONS.INVENTORY_POST,
      PERMISSIONS.PMO_MANAGE,
      PERMISSIONS.PMO_VIEW,
      PERMISSIONS.PMO_APPROVE,
      PERMISSIONS.TREASURY_MANAGE,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.TREASURY_TRANSACT,
      PERMISSIONS.FIXEDASSET_MANAGE,
      PERMISSIONS.FIXEDASSET_VIEW,
      PERMISSIONS.FIXEDASSET_DEPRECIATE,
      PERMISSIONS.FIXEDASSET_DISPOSE,
      PERMISSIONS.TAX_MANAGE,
      PERMISSIONS.TAX_VIEW,
      PERMISSIONS.TAX_REMIT,
      PERMISSIONS.EXECUTIVE_VIEW,
      PERMISSIONS.HR_MANAGE,
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HR_APPROVE,
      PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.PAYROLL_POST,
      PERMISSIONS.HSE_VIEW,
      PERMISSIONS.BUDGET_MANAGE,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.BUDGET_SUBMIT,
      PERMISSIONS.BUDGET_APPROVE,
      PERMISSIONS.BUDGET_TRANSFER,
      PERMISSIONS.BUDGET_COMMIT,
      PERMISSIONS.PROCUREMENT_MANAGE,
      PERMISSIONS.PROCUREMENT_VIEW,
      PERMISSIONS.PROCUREMENT_APPROVE,
      PERMISSIONS.PROCUREMENT_RECEIVE,
      PERMISSIONS.PROCUREMENT_MATCH,
      PERMISSIONS.AP_MANAGE,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.AP_APPROVE,
      PERMISSIONS.AP_PAY,
      PERMISSIONS.AR_MANAGE,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.BANKRECON_MANAGE,
      PERMISSIONS.BANKRECON_VIEW,
      PERMISSIONS.BANKRECON_APPROVE,
      PERMISSIONS.BANK_LINK_MANAGE,
      PERMISSIONS.BANK_LINK_VIEW,
      PERMISSIONS.BANK_TRANSFER_MANAGE,
      PERMISSIONS.BANK_TRANSFER_VIEW,
      PERMISSIONS.CALENDAR_MANAGE,
      PERMISSIONS.CALENDAR_VIEW,
      PERMISSIONS.CONTACTS_MANAGE,
      PERMISSIONS.CONTACTS_VIEW,
      PERMISSIONS.TASKS_MANAGE,
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TEAMS_MANAGE,
      PERMISSIONS.TEAMS_VIEW,
      PERMISSIONS.PRESENCE_VIEW,
      PERMISSIONS.WORKSPACEADMIN_MANAGE,
      PERMISSIONS.WORKSPACEADMIN_VIEW,
      PERMISSIONS.SIGNATURES_MANAGE,
      PERMISSIONS.SIGNATURES_VIEW,
      PERMISSIONS.POWER_BI_MANAGE,
      PERMISSIONS.POWER_BI_VIEW,
      PERMISSIONS.API_GATEWAY_MANAGE,
      PERMISSIONS.API_GATEWAY_VIEW,
      PERMISSIONS.WORKFLOW_ADMIN,
      PERMISSIONS.WORKFLOW_MANAGE,
      PERMISSIONS.WORKFLOW_VIEW,
      PERMISSIONS.WORKFLOW_ACT,
      PERMISSIONS.ADMIN_BRANDING_MANAGE,
      PERMISSIONS.ADMIN_BRANDING_VIEW,
      PERMISSIONS.ADMIN_TEMPLATES_MANAGE,
      PERMISSIONS.ADMIN_TEMPLATES_VIEW,
      PERMISSIONS.INTEGRATIONS_MANAGE,
      PERMISSIONS.INTEGRATIONS_VIEW,
      PERMISSIONS.AGENT_MANAGE,
      PERMISSIONS.AGENT_VIEW,
      PERMISSIONS.COMMISSION_MANAGE,
      PERMISSIONS.COMMISSION_VIEW,
      PERMISSIONS.COMMISSION_APPROVE,
    ],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    permissions: [
      PERMISSIONS.ENTITY_VIEW,
      PERMISSIONS.COA_VIEW,
      PERMISSIONS.DIMENSION_VIEW,
      PERMISSIONS.GL_JOURNAL_CREATE,
      PERMISSIONS.GL_JOURNAL_VIEW,
      PERMISSIONS.GL_REPORTS_VIEW,
      PERMISSIONS.INTERCOMPANY_CREATE,
      PERMISSIONS.INTERCOMPANY_VIEW,
      PERMISSIONS.REALESTATE_VIEW,
      PERMISSIONS.REVENUE_RECOGNIZE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_TRANSACT,
      PERMISSIONS.PMO_VIEW,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.TREASURY_TRANSACT,
      PERMISSIONS.FIXEDASSET_VIEW,
      PERMISSIONS.FIXEDASSET_DEPRECIATE,
      PERMISSIONS.TAX_VIEW,
      PERMISSIONS.TAX_REMIT,
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.BUDGET_SUBMIT,
      PERMISSIONS.BUDGET_COMMIT,
      PERMISSIONS.PROCUREMENT_VIEW,
      PERMISSIONS.PROCUREMENT_RECEIVE,
      PERMISSIONS.PROCUREMENT_MATCH,
      PERMISSIONS.AP_MANAGE,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.AP_PAY,
      PERMISSIONS.AR_MANAGE,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.BANKRECON_MANAGE,
      PERMISSIONS.BANKRECON_VIEW,
      PERMISSIONS.WORKFLOW_MANAGE,
      PERMISSIONS.WORKFLOW_VIEW,
      PERMISSIONS.WORKFLOW_ACT,
      PERMISSIONS.ADMIN_BRANDING_VIEW,
      PERMISSIONS.ADMIN_TEMPLATES_VIEW,
      PERMISSIONS.AGENT_VIEW,
      PERMISSIONS.COMMISSION_VIEW,
    ],
  },
  {
    code: 'VIEWER',
    name: 'Read-only Viewer',
    permissions: [
      PERMISSIONS.ENTITY_VIEW,
      PERMISSIONS.COA_VIEW,
      PERMISSIONS.DIMENSION_VIEW,
      PERMISSIONS.GL_JOURNAL_VIEW,
      PERMISSIONS.GL_REPORTS_VIEW,
      PERMISSIONS.INTERCOMPANY_VIEW,
      PERMISSIONS.CONSOLIDATION_VIEW,
      PERMISSIONS.REALESTATE_VIEW,
      PERMISSIONS.LANDBANK_VIEW,
      PERMISSIONS.CRM_VIEW,
      PERMISSIONS.MORTGAGE_VIEW,
      PERMISSIONS.HANDOVER_VIEW,
      PERMISSIONS.LEASE_VIEW,
      PERMISSIONS.FACILITY_VIEW,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.PMO_VIEW,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.FIXEDASSET_VIEW,
      PERMISSIONS.TAX_VIEW,
      PERMISSIONS.EXECUTIVE_VIEW,
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HSE_VIEW,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.PROCUREMENT_VIEW,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.BANKRECON_VIEW,
      PERMISSIONS.WORKFLOW_VIEW,
      PERMISSIONS.RECRUITMENT_VIEW,
      PERMISSIONS.ADMIN_BRANDING_VIEW,
      PERMISSIONS.ADMIN_TEMPLATES_VIEW,
      PERMISSIONS.AGENT_VIEW,
      PERMISSIONS.COMMISSION_VIEW,
    ],
  },
  {
    code: 'HR_MANAGER',
    name: 'HR Manager',
    permissions: [
      PERMISSIONS.ENTITY_VIEW,
      PERMISSIONS.DIMENSION_VIEW,
      PERMISSIONS.HR_MANAGE,
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HR_APPROVE,
      PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.WORKFLOW_VIEW,
      // Recruitment permissions merged in during harmonisation -- an HR
      // Manager needs to run the hiring pipeline, not just view it.
      // NOTE: RECRUITMENT_INTERVIEW (submit interview feedback) is deliberately
      // narrower and meant for arbitrary employees assigned as panelists, most
      // of whom will not otherwise hold the HR_MANAGER role. Granting it here
      // covers HR staff; a lightweight "interview panelist" grant (per-employee,
      // not a system role) is still needed for line managers/staff pulled in as
      // interviewers -- flagged in the harmonisation report as a follow-up.
      PERMISSIONS.RECRUITMENT_MANAGE,
      PERMISSIONS.RECRUITMENT_VIEW,
      PERMISSIONS.RECRUITMENT_INTERVIEW,
    ],
  },
  {
    // Non-human account used exclusively by apps/worker to call back into
    // the API so background jobs can reuse the real domain services
    // (payroll calculation, bank statement import, budget variance,
    // dashboard/report queries) instead of re-implementing that business
    // logic in the worker process. Scoped to read/execute the specific
    // operations the queue processors need — no user-management, no
    // journal posting, no consolidation.
    code: 'WORKER_SERVICE',
    name: 'Background Worker (service account)',
    permissions: [
      PERMISSIONS.ENTITY_VIEW,
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.BANKRECON_MANAGE,
      PERMISSIONS.BANKRECON_VIEW,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.GL_REPORTS_VIEW,
      PERMISSIONS.WORKFLOW_VIEW,
      // Release IA — needed for the scheduled integration-health-check job
      // (apps/worker/src/processors/integration-health-check.processor.ts)
      // to list active providers and record each one's health-check result.
      PERMISSIONS.INTEGRATIONS_MANAGE,
      PERMISSIONS.INTEGRATIONS_VIEW,
      // Release IE.1, Checkpoint E — needed for the scheduled payment
      // reconciliation job (apps/worker/src/processors/payment-reconciliation.processor.ts)
      // to call POST /payments/:reference/verify for each stale PENDING
      // transaction.
      PERMISSIONS.PAYMENT_MANAGE,
      PERMISSIONS.PAYMENT_RECONCILE,
    ],
  },
];
