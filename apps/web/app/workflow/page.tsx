import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateWorkflowDefinitionForm } from './CreateWorkflowDefinitionForm';
import { WorkflowDefinitionsTable } from './WorkflowTables';

export const dynamic = 'force-dynamic';

interface WorkflowStageSummary {
  id: string;
  sequence: number;
  name: string;
  stageType: string;
}

interface WorkflowDefinitionSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  stages: WorkflowStageSummary[];
}

interface RoleSummary {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion, FE-8.6 — Workflow, the first of the two
 * remaining confirmed-real FE-8 gaps FE-8.5's own report named
 * (Monitoring/Storage were confirmed NOT realistic page candidates that
 * same checkpoint; Notifications is the other real one, deliberately
 * left for its own future checkpoint).
 *
 * `WorkflowController` has 8 routes across two concerns (confirmed
 * directly): Definitions (no-code admin configuration — create/list/
 * find) and Instances (start/get/list-by-entity/act/resubmit — the
 * actual approval-chain execution history for real records elsewhere in
 * this app). This checkpoint scopes to Definitions ONLY, and within
 * that, to the two read-only GETs — `POST /workflow/definitions`
 * (`CreateWorkflowDefinitionDto`) was read in full before deciding to
 * defer it: it's a doubly-nested dynamic array (stages, each with its
 * own nested rules array, plus separate workflow-level rules) — a
 * genuinely larger no-code-builder UI than any single-level dynamic-line
 * form already in this app (`CreateBudgetForm`'s own lines are the
 * closest precedent, and this is a level of nesting beyond that).
 * Instances (`StartWorkflowInstanceDto`'s own `context` object, plus
 * `act`/`resubmit`) is a separate, real follow-on checkpoint on its own
 * scale, not attempted here either — named explicitly, not silently
 * dropped, the same posture FE-8.5's own report took toward its two
 * deferred trigger endpoints.
 *
 * `GET /workflow/definitions` (confirmed directly against
 * `WorkflowEngineService.listDefinitions`) takes an optional
 * `entityType` query filter — called unfiltered here (same "no filter
 * UI this checkpoint, the backend already supports one for later" call
 * FE-8.5's own Queue register made) and only `isActive: true` by the
 * service's own default, so inactive/retired definitions won't appear
 * here — not investigated further since surfacing them meaningfully
 * (an "include inactive" toggle) is exactly the kind of filter-UI
 * follow-on work already named as deferred.
 *
 * ADDENDUM (FE-8.7) — added a "Look up instances →" link to
 * `/workflow/instances`, the Instances checkpoint FE-8.6 itself
 * recommended next. No new nav entry for it — see that page's own doc
 * comment for why (mirrors `/workflow/[code]`'s own precedent of being
 * reached via a link rather than its own top-level nav item).
 *
 * ADDENDUM (FE-8.10) — added `CreateWorkflowDefinitionForm`, the
 * first-pass create form FE-8.9's own report recommended (flat
 * `stages[]` only, no `rules[]`/`workflowRules[]` — see that
 * component's and `actions.ts`'s own doc comments). `roleOptions` for
 * the form's own "required role" picker is fetched here via `GET
 * /roles` and degrades to an empty array on failure rather than a
 * page-level error — a genuinely different permission
 * (`RBAC_VIEW`) from what creating a definition itself needs
 * (`workflow.admin`), so a user with the latter but not the former
 * should still see a usable (if role-picker-less) form, not a broken
 * page.
 */
async function loadDefinitions() {
  return fetchApi<WorkflowDefinitionSummary[]>('/workflow/definitions');
}

async function loadRoleOptions(): Promise<SelectOption[]> {
  try {
    const roles = await fetchApi<RoleSummary[]>('/roles');
    return roles.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }));
  } catch {
    return [];
  }
}

export default async function WorkflowPage() {
  let definitions: WorkflowDefinitionSummary[] = [];
  let error: string | null = null;
  try {
    definitions = await loadDefinitions();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load workflow definitions.';
  }
  const roleOptions = await loadRoleOptions();

  return (
    <PageContainer>
      <PageHeader title="Workflow Definitions" subtitle="Reusable, no-code approval-chain templates used across this app's modules" />

      <p style={{ marginBottom: tokens.space(6) }}>
        <Link href="/workflow/instances" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Look up instances →
        </Link>
      </p>

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      <PageHeader title="New definition" />
      <CreateWorkflowDefinitionForm roleOptions={roleOptions} />

      <WorkflowDefinitionsTable rows={definitions} />
    </PageContainer>
  );
}
