import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { StartInstanceForm } from './StartInstanceForm';

export const dynamic = 'force-dynamic';

interface WorkflowRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  requiredRoleCode: string | null;
  description: string | null;
}

interface WorkflowStage {
  id: string;
  sequence: number;
  name: string;
  stageType: string;
  requiredRoleCode: string | null;
  minApprovals: number;
  rules: WorkflowRule[];
}

interface WorkflowDefinitionDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  stages: WorkflowStage[];
  rules: WorkflowRule[];
}

const OPERATOR_LABEL: Record<string, string> = {
  GT: '>',
  GTE: '≥',
  LT: '<',
  LTE: '≤',
  EQ: '=',
  NEQ: '≠',
  IN: 'in',
};

/**
 * Frontend Completion, FE-8.6 — Workflow Definition detail
 * (`/workflow/[code]`). See `../page.tsx`'s own doc comment for the
 * full scoping rationale (Definitions-read-only this checkpoint;
 * Instances and the create-form are both real, separate follow-on
 * work).
 *
 * `GET /workflow/definitions/:code` (confirmed directly against
 * `WorkflowEngineService.findDefinition`) returns stages (each with
 * their own nested `rules`) plus a separate top-level `rules` array —
 * confirmed directly against the Prisma schema's own comment that a
 * `WorkflowApprovalRule` with no `stageDefinitionId` is a WORKFLOW-level
 * rule ("skip this whole stage unless...", keyed by
 * `appliesToStageSequence` on write, per `CreateWorkflowRuleDto`) rather
 * than a stage-level one ("this specific approval needs X") — the two
 * are rendered as two separate sections below rather than merged into
 * one table, since collapsing that distinction would misrepresent what
 * each rule actually controls.
 *
 * `value` is rendered as-is (a raw JSON-encoded string per the DTO's
 * own comment — a number, string, boolean, or JSON array depending on
 * `field`) rather than parsed/reformatted per field type — this is a
 * read-only reference view, not a rule-evaluation simulator; showing
 * the raw stored value is honest about what's actually there, and
 * building a per-field-type formatter is real, separate scope this
 * checkpoint doesn't need.
 *
 * ADDENDUM (FE-8.9) — added `StartInstanceForm` ("Start an instance"),
 * the smaller of the two items FE-8.8's own report left deferred (see
 * `./actions.ts`'s own doc comment for the full before-coding
 * analysis). Rendered only when `definition.isActive` — confirmed
 * directly that `WorkflowEngineService.startInstance` itself throws a
 * `ConflictException` for an inactive workflow, so offering the form
 * for one would only ever produce a guaranteed-failing submit, the same
 * "don't offer what would always fail" posture this app takes
 * elsewhere (`PostAPInvoiceButton`/`MasterPlanActions`, among others).
 */
async function loadDefinition(code: string) {
  return fetchApi<WorkflowDefinitionDetail>(`/workflow/definitions/${code}`);
}

export default async function WorkflowDefinitionPage({ params }: { params: { code: string } }) {
  let definition: WorkflowDefinitionDetail | null = null;
  let error: string | null = null;
  try {
    definition = await loadDefinition(params.code);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load workflow definition.';
  }

  if (error || !definition) {
    return (
      <PageContainer>
        <PageHeader title="Workflow definition detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Workflow definition not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/workflow" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Workflow Definitions
          </Link>
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/workflow" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Workflow Definitions
        </Link>
      </p>

      <PageHeader
        title={`${definition.code} — ${definition.name}`}
        subtitle={[definition.entityType, definition.description].filter(Boolean).join(' · ') || undefined}
        breadcrumbs={[{ label: 'Workflow Definitions', href: '/workflow' }, { label: definition.code }]}
      />

      <section style={{ marginBottom: tokens.space(6) }}>
        <Badge tone={definition.isActive ? 'positive' : 'neutral'}>{definition.isActive ? 'Active' : 'Inactive'}</Badge>
      </section>

      {definition.isActive ? (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Start an instance" />
          <StartInstanceForm workflowCode={definition.code} entityType={definition.entityType} />
        </section>
      ) : (
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, marginBottom: tokens.space(8) }}>
          This workflow is inactive — new instances can&apos;t be started against it.
        </p>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Stages" />
        <DataTable
          columns={[
            { header: '#', align: 'right', render: (s: WorkflowStage) => String(s.sequence) },
            { header: 'Name', render: (s: WorkflowStage) => s.name },
            { header: 'Type', render: (s: WorkflowStage) => s.stageType },
            { header: 'Required role', render: (s: WorkflowStage) => s.requiredRoleCode ?? '—' },
            { header: 'Min approvals', align: 'right', render: (s: WorkflowStage) => String(s.minApprovals) },
            { header: 'Stage rules', align: 'right', render: (s: WorkflowStage) => String(s.rules.length) },
          ]}
          rows={definition.stages}
          keyOf={(s) => s.id}
          emptyMessage="This workflow has no stages."
        />
      </section>

      {definition.stages.some((s) => s.rules.length > 0) && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Stage-level rules" subtitle="Conditions that change how a specific stage's approval is required" />
          <DataTable
            columns={[
              {
                header: 'Stage',
                render: (r: WorkflowRule & { stageName: string }) => r.stageName,
              },
              { header: 'Field', render: (r: WorkflowRule) => r.field },
              { header: 'Operator', render: (r: WorkflowRule) => OPERATOR_LABEL[r.operator] ?? r.operator },
              { header: 'Value', render: (r: WorkflowRule) => r.value },
              { header: 'Required role', render: (r: WorkflowRule) => r.requiredRoleCode ?? '—' },
              { header: 'Description', render: (r: WorkflowRule) => r.description ?? '—' },
            ]}
            rows={definition.stages.flatMap((s) => s.rules.map((r) => ({ ...r, stageName: s.name })))}
            keyOf={(r) => r.id}
            emptyMessage="No stage-level rules."
          />
        </section>
      )}

      {definition.rules.length > 0 && (
        <section>
          <PageHeader title="Workflow-level rules" subtitle="Conditions that decide whether an entire stage applies at all" />
          <DataTable
            columns={[
              { header: 'Field', render: (r: WorkflowRule) => r.field },
              { header: 'Operator', render: (r: WorkflowRule) => OPERATOR_LABEL[r.operator] ?? r.operator },
              { header: 'Value', render: (r: WorkflowRule) => r.value },
              { header: 'Required role', render: (r: WorkflowRule) => r.requiredRoleCode ?? '—' },
              { header: 'Description', render: (r: WorkflowRule) => r.description ?? '—' },
            ]}
            rows={definition.rules}
            keyOf={(r) => r.id}
            emptyMessage="No workflow-level rules."
          />
        </section>
      )}
    </PageContainer>
  );
}
