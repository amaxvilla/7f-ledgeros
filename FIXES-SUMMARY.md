# 7F LedgerOS — TypeScript error fixes

Schema, migrations, and database are untouched. 21 files changed, all under
`apps/api/src`. Apply with `apply-fixes.ps1` (see instructions below).

## 1. DocumentTemplate / Admin Branding
`DocumentTemplate.entityId` is a required (non-null) FK in the schema, but
`admin-branding.service.ts` tried to model "global default templates" using
`entityId: null`. That row can never exist in the database, so the fallback
was dead code. Fixed by making `entityId` required end-to-end (DTO, service,
controller docs) and removing the impossible fallback branch. One test that
asserted the old (impossible) fallback behavior was updated to match.

## 2. Workflow Engine
`WorkflowApprovalRule` has two independent FK columns — `workflowDefinitionId`
(always required) and `stageDefinitionId` (optional). The code nest-created
rules under `stages.create[].rules.create`, which only ever supplies
`stageDefinitionId` via the relation, leaving the required
`workflowDefinitionId` unset. Fixed by creating the definition + bare stages
first, then creating all rules (stage-level and workflow-level) in one
`createMany` pass once real IDs exist for both FKs.

## 3. Reporting Service (TS4053)
`declaration: true` is set in `tsconfig.base.json`. When a public method's
inferred return type references a non-exported interface, TS4053 fires.
`ProfitAndLossViewRow`, `FinancialPositionViewRow`, and
`FixedAssetRegisterViewRow` are now `export interface`.

## 4. Security Hardening (entityId contract)
`RowLevelSecurityService.canAccess()`'s `record` parameter only accepted
`string | null` per field, but callers build that object from a mix of
nullable Prisma FK columns (`string | null`) and optional
DTO/function params (`string | undefined`). Widened the accepted type to
`string | null | undefined` — the existing `!value` check already treats
both the same way, so this is a pure type-contract fix with no behavior
change.

## 5–8. Enum `.includes()` / `Set.has()` narrowing (Facility, Leave,
Procurement, Recruitment)
Classic TS inference gotcha: an inline array literal of enum members used
directly with `.includes()` (or `Set.has()`) infers as the union of just
those specific members, not the full enum type — so comparing it against a
full-enum-typed value fails to type-check. Fixed by casting each inline
array literal to the enum's array type (`as EnumType[]`), and by explicitly
annotating the recruitment module's `Set<ApplicationStage>`. Swept the rest
of `apps/api/src` for the same pattern — these were the only occurrences.

## 9. Authentication Tests
`AuthService.login()` returns a union: the MFA-challenge shape has no
`accessToken` at all. Several tests read `.accessToken` off the raw union
without narrowing first. Added a small `expectTokensIssued()` helper in the
spec file that narrows to the non-MFA branch (throwing a clear error if the
service unexpectedly returned a challenge instead), and used it at each of
the 4 call sites that needed it.

## 10. Payroll Tests (Decimal arithmetic)
`Payslip`'s financial columns are `Decimal @db.Decimal(18,2)` in the schema
(financial fields correctly stay `Decimal`, not `Float`, per your
instruction). The service's aggregation path already wraps values in
`Number(...)` correctly. The test, however, did raw arithmetic
(`payslip.grossPay - payslip.payeTax - ...`) on values typed as `Decimal` at
compile time. Wrapped each operand in `Number(...)` in the test, matching
the pattern already used correctly in the service.

## 11. Inventory Tests
The Prisma mock object's type only declared `goodsReceipt`, `materialIssue`,
`stockTransfer`, `stockCount` — but two tests (Row Level Security section)
call `prisma.warehouse.findMany` and `prisma.stockItem.findMany`. Added both
models to the mock's type and its construction in `beforeEach`.

## 12. Unused imports/variables
Removed 11 confirmed-unused named imports across services, DTOs, and tests
(verified each by checking it had zero other references in its file before
removing). Also replaced a destructure-and-discard pattern
(`const { entityId: _e, ... } = query`) in `admin-branding.controller.ts`
with explicit `delete` calls, since TS's `noUnusedLocals` flags unused
destructured bindings even when prefixed with `_` (that exemption only
applies to function parameters, not local bindings).

## 13. Everything else
I don't have a working `pnpm install` / `tsc` in my environment (no network
access), so I can't produce a live, verified count of the original ~58
errors or guarantee this closes 100% of them — I worked from static reading
of your actual source, schema, and the error categories you described.
`apply-fixes.ps1` runs `tsc --noEmit` and the test suite for you and saves
full output to `tsc-output.txt` / `test-output.txt`. Paste those back to me
and I'll fix whatever's left in the next pass.

## How to apply

1. Put `7f-ledgeros-ts-fixes.patch` and `apply-fixes.ps1` in your project
   root (same folder as `package.json`).
2. In VS Code's PowerShell terminal, from the project root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\apply-fixes.ps1
   ```
3. It dry-runs the patch first (nothing is touched if it can't apply
   cleanly), applies it, regenerates the Prisma client, builds workspace
   packages, type-checks `apps/api`, and runs its tests — saving full logs
   to `tsc-output.txt` and `test-output.txt` in the project root.
4. Send me those two files (or just paste the error list) and I'll keep
   going.
