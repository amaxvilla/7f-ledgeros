import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateRiskForm } from './CreateRiskForm';
import { CloseRiskButton } from './CloseRiskButton';
import { RiskRowActions } from './RiskRowActions';
import { RiskWorkflowActions } from './RiskWorkflowActions';

export const dynamic = 'force-dynamic';

interface ProjectRisk {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  probability: string;
  impact: string;
  riskScore: number;
  status: string;
  identifiedAt: string;
}

interface PmoRiskIssueOverview {
  risksByStatus: { status: string; count: number }[];
}

interface Project {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion — Project Risks, the first PMO page. Picked over
 * PMO's own Work Packages/BOQs/Certificates (also entirely page-less)
 * because it's the narrowest complete slice: `RiskController`
 * (`project-risks`) is one resource with one clear terminal action
 * (`close`), versus the Work Package/BOQ/Certificate chain's own
 * multi-stage `advance()` workflow, which is a bigger, differently-
 * shaped checkpoint on its own. `IssueController` (`project-issues`) —
 * genuinely the same size and shape as this one, and `convertRiskToIssue`
 * even links the two models — was deliberately left for a follow-on
 * checkpoint rather than doubled up here, same "one resource, not two"
 * discipline Bank Integration's own checkpoint applied to link/list/
 * revoke vs. balance/statement-import.
 *
 * ADDENDUM — `projectId` NOW HAS A REAL REGISTRY. This doc comment
 * previously claimed "NO PROJECTS REGISTRY EXISTS ANYWHERE IN THIS
 * BACKEND," confirmed at the time by grepping every `*.controller.ts`
 * for a `projects` route. That claim was WRONG — caught during FE-2.5
 * (`ProjectSelector`/PMO Dashboard's own checkpoint): `GET
 * /dimensions/projects?entityId=X` (`DimensionsController.findProjects`)
 * has existed the whole time. This checkpoint is the small follow-up
 * FE-2.5's own report named: `loadProjectRisks` now also fetches this
 * entity's own projects, builds `projectOptions` (a `SelectOption[]`)
 * for `CreateRiskForm`'s own `projectId` `Select` (see that component's
 * own doc comment), and a `projectId -> "<code> — <name>"` lookup map so
 * this page's own register table shows a real project name/code instead
 * of a raw UUID in its Project column — the same lookup-map reuse
 * `/budgeting/[id]/page.tsx`'s own `lineLabels` already established.
 *
 * `GET /project-risks` (`RiskController.findAll`) takes no `entityId` —
 * it's scoped entirely through `SecurityContextService.buildScope`
 * (RLS on `entity`/`businessUnit`), the same shape `security/page.tsx`
 * already established for an endpoint with no entity filter at all.
 * Unlike that page, though, `EntitySelector` IS still needed here —
 * `CreateRiskDto.entityId` is a required, `@RlsBodyCheck`-validated
 * body field the create form has to supply, even though the list
 * itself isn't filtered by it. So this page's own `entityId` only ever
 * flows into `CreateRiskForm`/the new `projects` fetch, never into the
 * risks list itself — worth stating plainly since every other page's
 * `entityId` does both.
 *
 * `GET /dashboard/pmo-risk-issue-overview` is called with no query
 * params at all — its own `projectId` filter is optional, and there's
 * no project selector on this page to supply one; its `entityId`
 * support that `RiskIssueService.getRiskIssueSummary` actually has
 * (read directly) isn't even reachable through the dashboard route,
 * which only forwards `projectId` — a pre-existing gap in that one
 * route, not something this checkpoint touches. Only `risksByStatus` is
 * used for the KPI section; `topOpenRisks`/`issuesByStatus`/
 * `openIssuesByPriority` are issue-related or redundant with this
 * page's own already-riskScore-sorted table, so they're left unused
 * rather than surfaced for the sake of it.
 *
 * ADDENDUM (FE-1.5) — `assignOwner`/`convertRiskToIssue`, named above
 * as deliberately left for a follow-on, are surfaced now: see the new
 * `RiskRowActions.tsx` (rendered as a second component in the Actions
 * cell, stacked below `CloseRiskButton`). `assess`/`mitigation-plan`/
 * `monitor` remain unsurfaced — a separate, workflow-progression-shaped
 * trio (`IDENTIFIED -> ASSESSED -> MITIGATING -> MONITORING`), a
 * genuinely different shape from the two "meaningful at any stage, no
 * sequencing" actions this checkpoint picked, worth its own checkpoint
 * rather than folded in here.
 *
 * ADDENDUM (FE-1.6) — `assess`/`mitigation-plan`/`monitor`, named just
 * above as still deferred, are surfaced now: see the new
 * `RiskWorkflowActions.tsx` (a third component stacked in the same
 * Actions cell, below `RiskRowActions`). This closes out `RiskController`
 * in full — every one of its actions now has frontend coverage.
 */
async function loadProjectRisks(entityId: string) {
  const [risks, overview, projects] = await Promise.all([
    fetchApi<ProjectRisk[]>('/project-risks'),
    fetchApi<PmoRiskIssueOverview>('/dashboard/pmo-risk-issue-overview'),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const closedCount = overview.risksByStatus.find((r) => r.status === 'CLOSED')?.count ?? 0;
  const totalCount = overview.risksByStatus.reduce((sum, r) => sum + r.count, 0);

  const projectOptions: SelectOption[] = projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const projectNames = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));

  return { risks, kpis: { total: totalCount, active: totalCount - closedCount, closed: closedCount }, projectOptions, projectNames };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  IDENTIFIED: 'neutral',
  ASSESSED: 'neutral',
  MITIGATING: 'warning',
  MONITORING: 'warning',
  OCCURRED: 'negative',
  CLOSED: 'positive',
};

export default async function ProjectRisksPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Project Risks" subtitle="Enter an entity ID to log a new risk against it." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadProjectRisks>> | null = null;
  let error: string | null = null;
  try {
    data = await loadProjectRisks(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load project risks.';
  }

  return (
    <PageContainer>
      <PageHeader title="Project Risks" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total risks" value={String(data.kpis.total)} />
            <KpiCard label="Active" value={String(data.kpis.active)} tone={data.kpis.active > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Closed" value={String(data.kpis.closed)} tone="positive" />
          </section>

          <section>
            <PageHeader title="Risk register" />
            <CreateRiskForm entityId={entityId} projectOptions={data.projectOptions} />
            <DataTable
              columns={[
                { header: 'Title', render: (r: ProjectRisk) => r.title },
                { header: 'Project', render: (r: ProjectRisk) => data.projectNames.get(r.projectId) ?? r.projectId },
                { header: 'Probability', render: (r: ProjectRisk) => r.probability },
                { header: 'Impact', render: (r: ProjectRisk) => r.impact },
                { header: 'Score', align: 'right', render: (r: ProjectRisk) => String(r.riskScore) },
                { header: 'Status', render: (r: ProjectRisk) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Identified', render: (r: ProjectRisk) => new Date(r.identifiedAt).toLocaleDateString() },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (r: ProjectRisk) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end' }}>
                      <CloseRiskButton id={r.id} status={r.status} />
                      <RiskRowActions id={r.id} status={r.status} />
                      <RiskWorkflowActions id={r.id} status={r.status} />
                    </div>
                  ),
                },
              ]}
              rows={data.risks}
              keyOf={(r) => r.id}
              emptyMessage="No risks logged yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
