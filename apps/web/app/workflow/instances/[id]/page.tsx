import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { ActOnWorkflowForm } from '../ActOnWorkflowForm';
import { ResubmitInstanceButton } from '../ResubmitInstanceButton';
import { WorkflowInstanceStagesTable, WorkflowActionHistoryTable } from '../../WorkflowTables';

export const dynamic = 'force-dynamic';

interface WorkflowActionRecord {
  id: string;
  stageInstanceId: string;
  actorId: string;
  action: string;
  comments: string | null;
  actedAt: string;
}

interface WorkflowStageDefinitionSummary {
  id: string;
  name: string;
  stageType: string;
}

interface WorkflowStageInstanceDetail {
  id: string;
  sequence: number;
  status: string;
  requiredRoleCode: string | null;
  requiredApprovals: number;
  approvalsReceived: number;
  activatedAt: string | null;
  completedAt: string | null;
  stageDefinition: WorkflowStageDefinitionSummary;
  actions: WorkflowActionRecord[];
}

interface WorkflowDefinitionSummary {
  code: string;
  name: string;
}

interface WorkflowInstanceDetail {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  context: Record<string, unknown>;
  startedById: string;
  startedAt: string;
  completedAt: string | null;
  stageInstances: WorkflowStageInstanceDetail[];
  workflowDefinition: WorkflowDefinitionSummary;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  IN_PROGRESS: 'warning',
  APPROVED: 'positive',
  POSTED: 'positive',
  ARCHIVED: 'neutral',
  REJECTED: 'negative',
  RETURNED: 'negative',
  CANCELLED: 'neutral',
};

const STAGE_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PENDING: 'neutral',
  ACTIVE: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  RETURNED: 'negative',
};

/**
 * Frontend Completion, FE-8.7 — Workflow Instance detail
 * (`/workflow/instances/[id]`). See `../page.tsx`'s own doc comment
 * for the fuller before-coding analysis of this checkpoint.
 *
 * `GET /workflow/instances/:id` (confirmed directly against
 * `WorkflowEngineService.getInstance`) returns `stageInstances` (each
 * with its own `stageDefinition` AND `actions` nested), plus the
 * parent `workflowDefinition` — a richer include than
 * `getInstancesForEntity`'s own list-query shape (no `stageDefinition`/
 * `actions` there), which is why the list page's own row only shows a
 * stage sequence number while this page can show real stage names and
 * a full action history per stage.
 *
 * `context` (confirmed directly as a Prisma `Json` column, an
 * `WorkflowContextDto` snapshot captured once at `startInstance` time)
 * is rendered as a plain key/value list — it's a genuinely open, loose
 * shape (7 optional fields, per that DTO), not something worth
 * building a typed renderer for on a read-only detail page.
 *
 * `ActOnWorkflowForm` is rendered only when `status === 'IN_PROGRESS'`;
 * `ResubmitInstanceButton` only when `status === 'RETURNED'` — both
 * confirmed directly as the only statuses their respective backend
 * routes accept (see `actions.ts`'s and each component's own doc
 * comment), the same "don't offer a click the backend would reject"
 * posture this app takes throughout, rather than always rendering both
 * and relying on the backend's own error message to explain why a
 * click failed.
 *
 * `WorkflowAction.actorId` is not rendered as a name — same "no
 * reachable Users/Employees registry from this permission scope"
 * finding this app's history already has for `assignedToId`/
 * `conductedById`/`employeeId`/`inspectorId` elsewhere (most recently
 * `hse/actions.ts`'s own doc comment) — showing the raw id would be
 * technically accurate but not meaningfully more useful than omitting
 * it, so it's left off the action-history table entirely rather than
 * shown as an unreadable id.
 */
async function loadInstance(id: string) {
  return fetchApi<WorkflowInstanceDetail>(`/workflow/instances/${id}`);
}

export default async function WorkflowInstanceDetailPage({ params }: { params: { id: string } }) {
  let instance: WorkflowInstanceDetail | null = null;
  let error: string | null = null;
  try {
    instance = await loadInstance(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load workflow instance.';
  }

  if (error || !instance) {
    return (
      <PageContainer>
        <PageHeader title="Workflow instance detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Workflow instance not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/workflow/instances" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Workflow Instances
          </Link>
        </p>
      </PageContainer>
    );
  }

  const contextEntries = Object.entries(instance.context ?? {}).filter(([, v]) => v !== null && v !== undefined);

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/workflow/instances" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Workflow Instances
        </Link>
      </p>

      <PageHeader
        title={`${instance.workflowDefinition.code} — ${instance.entityType} ${instance.entityId}`}
        subtitle={instance.workflowDefinition.name}
        breadcrumbs={[
          { label: 'Workflow Definitions', href: '/workflow' },
          { label: 'Instances', href: '/workflow/instances' },
          { label: instance.id },
        ]}
      />

      <section style={{ marginBottom: tokens.space(6), display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Badge tone={STATUS_TONE[instance.status] ?? 'neutral'}>{instance.status}</Badge>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Started {new Date(instance.startedAt).toLocaleString()}
          {instance.completedAt ? ` · Completed ${new Date(instance.completedAt).toLocaleString()}` : ''}
        </span>
      </section>

      {contextEntries.length > 0 && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Context" subtitle="Snapshot of the values this instance's rules were evaluated against" />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.space(1),
              padding: tokens.space(4),
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
            }}
          >
            {contextEntries.map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: tokens.space(2), fontFamily: tokens.font.body, fontSize: '13px' }}>
                <strong style={{ minWidth: '140px' }}>{key}</strong>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {instance.status === 'IN_PROGRESS' && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Act on this instance" />
          <ActOnWorkflowForm instanceId={instance.id} />
        </section>
      )}

      {instance.status === 'RETURNED' && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Resubmit" subtitle="Reactivates the first stage after a return" />
          <ResubmitInstanceButton instanceId={instance.id} />
        </section>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Stages" />
        <WorkflowInstanceStagesTable rows={instance.stageInstances} />
      </section>

      <section>
        <PageHeader title="Action history" />
        <WorkflowActionHistoryTable rows={instance.stageInstances.flatMap((s) => s.actions.map((a) => ({ ...a, stageSequence: s.sequence })))} />
      </section>
    </PageContainer>
  );
}
