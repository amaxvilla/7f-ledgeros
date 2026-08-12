import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateIssueForm } from './CreateIssueForm';
import { ResolveIssueButton } from './ResolveIssueButton';
import { IssueRowActions } from './IssueRowActions';

export const dynamic = 'force-dynamic';

interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  priority: string;
  status: string;
  assignedToId: string | null;
  dueDate: string | null;
  raisedAt: string;
}

interface PmoRiskIssueOverview {
  issuesByStatus: { status: string; count: number }[];
}

interface Project {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion — Project Issues, `project-risks/page.tsx`'s own
 * recommended follow-on: the `IssueController` counterpart to that
 * checkpoint's `RiskController` page, same size and shape, linked to it
 * via `convertRiskToIssue` on the risk side (not surfaced by either
 * page — that's a risk-row action, deferred along with the rest of
 * `RiskController`'s own un-surfaced actions).
 *
 * ADDENDUM — same Projects-registry correction as
 * `project-risks/page.tsx`'s own addendum, applied here unchanged:
 * `projectId` now has a real registry (`GET
 * /dimensions/projects?entityId=X`, corrected during FE-2.5), so
 * `loadProjectIssues` fetches this entity's own projects, builds
 * `projectOptions` for `CreateIssueForm`'s own `Select` and a
 * `projectId -> "<code> — <name>"` lookup for this page's own register
 * table's Project column — see that page's own addendum for the fuller
 * reasoning, not re-derived here.
 *
 * ONE REAL DIFFERENCE FROM PROJECT RISKS, found by reading
 * `RiskIssueService.closeIssue` directly rather than assuming symmetry
 * with `closeRisk`: closing an issue requires it to already be
 * `RESOLVED` (`BadRequestException` otherwise) — `close` isn't a
 * same-shape terminal action here the way it was for risks. `resolve`
 * (`POST .../resolve`, callable from any non-CLOSED status) is the
 * closer analog to `closeRisk`'s own "the one terminal-ish action a
 * user reaches for" role, so that's what `ResolveIssueButton` calls —
 * `close` itself is left unsurfaced this checkpoint, alongside
 * `assign`/`start`/`escalate`, all deferred as row actions this page
 * doesn't yet have room for (same "one resource, one action" budget
 * `project-risks/page.tsx` itself used).
 *
 * `GET /dashboard/pmo-risk-issue-overview`'s `issuesByStatus` (unused by
 * the risks page) is what this page's KPI section reads instead of
 * `risksByStatus` — same aggregate call, different field, no new
 * endpoint needed.
 *
 * ADDENDUM (FE-1.4) — `assign`/`start`/`escalate`, named above as
 * deferred, are deferred no longer: see the new `IssueRowActions.tsx`
 * for all three (rendered as a second component in the Actions cell,
 * stacked below `ResolveIssueButton` rather than merged into it — that
 * file's own doc comment explains why it's a separate component).
 * `close` remains the one action still unsurfaced on this page.
 */
async function loadProjectIssues(entityId: string) {
  const [issues, overview, projects] = await Promise.all([
    fetchApi<ProjectIssue[]>('/project-issues'),
    fetchApi<PmoRiskIssueOverview>('/dashboard/pmo-risk-issue-overview'),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const closedCount = overview.issuesByStatus.find((r) => r.status === 'CLOSED')?.count ?? 0;
  const totalCount = overview.issuesByStatus.reduce((sum, r) => sum + r.count, 0);

  const projectOptions: SelectOption[] = projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const projectNames = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));

  return { issues, kpis: { total: totalCount, active: totalCount - closedCount, closed: closedCount }, projectOptions, projectNames };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'warning',
  ESCALATED: 'negative',
  RESOLVED: 'positive',
  CLOSED: 'neutral',
};

export default async function ProjectIssuesPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Project Issues" subtitle="Enter an entity ID to log a new issue against it." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadProjectIssues>> | null = null;
  let error: string | null = null;
  try {
    data = await loadProjectIssues(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load project issues.';
  }

  return (
    <PageContainer>
      <PageHeader title="Project Issues" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total issues" value={String(data.kpis.total)} />
            <KpiCard label="Active" value={String(data.kpis.active)} tone={data.kpis.active > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Closed" value={String(data.kpis.closed)} tone="positive" />
          </section>

          <section>
            <PageHeader title="Issue register" />
            <CreateIssueForm entityId={entityId} projectOptions={data.projectOptions} />
            <DataTable
              columns={[
                { header: 'Title', render: (r: ProjectIssue) => r.title },
                { header: 'Project', render: (r: ProjectIssue) => data.projectNames.get(r.projectId) ?? r.projectId },
                { header: 'Priority', render: (r: ProjectIssue) => r.priority },
                { header: 'Status', render: (r: ProjectIssue) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Assigned to', render: (r: ProjectIssue) => r.assignedToId ?? '—' },
                { header: 'Due', render: (r: ProjectIssue) => (r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—') },
                { header: 'Raised', render: (r: ProjectIssue) => new Date(r.raisedAt).toLocaleDateString() },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (r: ProjectIssue) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end' }}>
                      <ResolveIssueButton id={r.id} status={r.status} />
                      <IssueRowActions id={r.id} status={r.status} />
                    </div>
                  ),
                },
              ]}
              rows={data.issues}
              keyOf={(r) => r.id}
              emptyMessage="No issues logged yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
