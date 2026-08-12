/**
 * Phase 2 — Enterprise Security shared types.
 */

/** The dimensions RLS can scope a query by. */
export type SecurityDimension = 'entity' | 'department' | 'costCenter' | 'project' | 'businessUnit';

export interface DimensionScope {
  /** true if this user is exempt from filtering on this dimension entirely
   *  (SYSTEM_ADMIN, or a permission such as `entity.manage` that implies
   *  cross-entity visibility). */
  unrestricted: boolean;
  /** IDs the user may VIEW. Empty array + unrestricted=false means "no access
   *  to anything on this dimension" (fail closed). */
  viewableIds: string[];
  /** IDs the user may POST/mutate against. Subset of viewableIds. */
  postableIds: string[];
}

/**
 * The fully-resolved access scope for one request, across every RLS
 * dimension. Built once per request by SecurityContextService and reused by
 * the RowLevelSecurityService, guards, and controllers/services that need to
 * do manual scoping (e.g. cross-dimension aggregate reports).
 */
export interface SecurityScope {
  userId: string;
  isSystemAdmin: boolean;
  entity: DimensionScope;
  department: DimensionScope;
  costCenter: DimensionScope;
  project: DimensionScope;
  /** Phase 2 — resolved from UserBusinessUnitAccess grants down to the set
   *  of Entity ids under those Business Units. Physically enforced via the
   *  same `entityId` column as the `entity` dimension (see
   *  RowLevelSecurityService's DIMENSION_FIELD map) — a model with the
   *  `entity` dimension declared is automatically also businessUnit-safe
   *  the moment a caller adds `'businessUnit'` to its `dimensions` list. */
  businessUnit: DimensionScope;
}

/** Which sensitive field groups exist and which permission unmasks each. */
export const SENSITIVE_FIELD_GROUPS = {
  salary: 'security.field.salary.view',
  bankDetails: 'security.field.bank_details.view',
  taxId: 'security.field.tax_id.view',
  payrollDetail: 'security.field.payroll_detail.view',
  loanValues: 'security.field.loan_values.view',
  costRates: 'security.field.cost_rates.view',
  medicalRecords: 'security.field.medical_records.view',
  execCompensation: 'security.field.exec_compensation.view',
  sensitiveHr: 'security.field.sensitive_hr.view',
} as const;

export type SensitiveFieldGroup = keyof typeof SENSITIVE_FIELD_GROUPS;

/** Value substituted in for a field the caller isn't permitted to see. */
export const MASKED_VALUE = '••••••••';
