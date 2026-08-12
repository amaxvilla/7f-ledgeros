import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { InstanceLookupForm } from './InstanceLookupForm';

export const dynamic = 'force-dynamic';

interface WorkflowStageInstanceSummary {
  id: string;
  sequence: number;
  status: string;
}

interface WorkflowInstanceSummary {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stageInstances: WorkflowStageInstanceSummary[];
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

/**
 * Frontend Completion, FE-8.7 — Workflow Instances, FE-8.6's own
 * recommended next checkpoint: the execution-history side of the
 * Workflow module (as opposed to that checkpoint's Definitions
 * templates).
 *
 * **A GENUINELY DIFFERENT SHAPE FROM `/workflow`'S OWN LIST PAGE,
 * CONFIRMED DIRECTLY RATHER THAN ASSUMED SYMMETRIC**: re-read
 * `WorkflowController` before designing this page and confirmed there
 * is NO route that lists all instances, or all pending-for-me
 * instances — `getInstancesForEntity` (`GET /workflow/instances`)
 * requires BOTH `entityType` and `entityId` as query params (neither
 * optional in the controller's own signature). This module has no
 * single owning entity the way, say, Procurement's requisitions do —
 * `entityType`/`entityId` are a loose reference to a record in
 * whichever OTHER module started the instance (Recruitment,
 * Procurement, Budgeting, or something built later — confirmed
 * directly against `StartWorkflowInstanceDto`'s own comment). A plain
 * register table has nothing to page through without that pair
 * supplied first, so this had to become a lookup page, not a list
 * page — `InstanceLookupForm` mirrors `tax/TaxPositionForm.tsx`'s own
 * native-GET-form pattern for exactly that reason (a query, not a
 * mutation, driven by `searchParams`).
 *
 * Confirmed directly this app already has ONE real internal consumer
 * of this engine (`recruitment/RequisitionActions.tsx`'s own
 * `hasWorkflowInstance`/`refreshRequisitionApproval` wiring) — but it
 * wraps the engine behind its own domain-specific
 * `recruitment.controller.ts` endpoints rather than calling
 * `WorkflowController` directly from the frontend, so this checkpoint
 * doesn't change or link from that page; this is a genuinely separate,
 * generic admin-facing capability (inspect/act on ANY instance across
 * ANY consuming module by its own entityType/entityId or id), not a
 * replacement for a module's own purpose-built approval UI.
 *
 * No new nav entry — mirrors `/workflow/[code]`'s own precedent (no
 * nav entry of its own; reached via a link from the list page). A
 * "Look up instances →" link was added to `/workflow`'s own page
 * instead.
 */
async function loadInstances(entityType: string, entityId: string) {
  return fetchApi<WorkflowInstanceSummary[]>(
    `/workflow/instances?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
  );
}

export default async function WorkflowInstancesPage({
  searchParams,
}: {
  searchParams: { entityType?: string; entityId?: string };
}) {
  const entityType = searchParams.entityType;
  const entityId = searchParams.entityId;

  let instances: WorkflowInstanceSummary[] = [];
  let error: string | null = null;
  let searched = false;

  if (entityType && entityId) {
    searched = true;
    try {
      instances = await loadInstances(entityType, entityId);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load workflow instances.';
    }
  }

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/workflow" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Workflow Definitions
        </Link>
      </p>

      <PageHeader
        title="Workflow Instances"
        subtitle="Approval-chain execution history for a specific record in another module"
        breadcrumbs={[{ label: 'Workflow Definitions', href: '/workflow' }, { label: 'Instances' }]}
      />

      <InstanceLookupForm entityType={entityType} entityId={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {searched && !error && (
        <DataTable
          columns={[
            { header: 'Started', render: (i: WorkflowInstanceSummary) => new Date(i.startedAt).toLocaleString() },
            { header: 'Status', render: (i: WorkflowInstanceSummary) => <Badge tone={STATUS_TONE[i.status] ?? 'neutral'}>{i.status}</Badge> },
            {
              header: 'Active stage',
              render: (i: WorkflowInstanceSummary) => {
                const active = i.stageInstances.find((s) => s.status === 'ACTIVE');
                return active ? `#${active.sequence}` : '—';
              },
            },
            { header: 'Completed', render: (i: WorkflowInstanceSummary) => (i.completedAt ? new Date(i.completedAt).toLocaleString() : '—') },
            {
              header: '',
              render: (i: WorkflowInstanceSummary) => (
                <Link href={`/workflow/instances/${i.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                  View →
                </Link>
              ),
            },
          ]}
          rows={instances}
          keyOf={(i) => i.id}
          emptyMessage="No workflow instances found for that entity."
        />
      )}
    </PageContainer>
  );
}
