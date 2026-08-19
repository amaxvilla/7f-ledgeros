import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateRiskForm } from './CreateRiskForm';
import { ProjectRisksTable } from './ProjectRisksTable';
import type { ProjectRisk } from './ProjectRisksTable';

export const dynamic = 'force-dynamic';

interface PmoRiskIssueOverview {
  risksByStatus: { status: string; count: number }[];
}

interface Project {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion â€” Project Risks, the first PMO page. Picked over
 * PMO's own Work Packages/BOQs/Certificates (also entirely page-less)
 * because it's the narrowest complete slice: `RiskController`
 * (`project-risks`) is one resource with one clear terminal action
 * (`close`), versus the Work Package/BOQ/Certificate chain's own
 * multi-stage `advance()` workflow, which is a bigger, differently-
 * shaped checkpoint on its own. `IssueController` (`project-issues`) â€”
 * genuinely the same size and shape as this one, and `convertRiskToIssue`
 * even links the two models â€” was deliberately left for a follow-on
 * checkpoint rather than doubled up here, same "one resource, not two"
 * discipline Bank Integration's own checkpoint applied to link/list/
 * revoke vs. balance/statement-import.
 *
 * ADDENDUM â€” `projectId` NOW HAS A REAL REGISTRY. This doc comment
 * previously claimed "NO PROJECTS REGISTRY EXISTS ANYWHERE IN THIS
 * BACKEND," confirmed at the time by grepping every `*.controller.ts`
 * for a `projects` route. That claim was WRONG â€” caught during FE-2.5
 * (`ProjectSelector`/PMO Dashboard's own checkpoint): `GET
 * /dimensions/projects?entityId=X` (`DimensionsController.findProjects`)
 * has existed the whole time. This checkpoint is the small follow-up
 * FE-2.5's own report named: `loadProjectRisks` now also fetches this
 * entity's own projects, builds `projectOptions` (a `SelectOption[]`)
 * for `CreateRiskForm`'s own `projectId` `Select` (see that component's
 * own doc comment), and a `projectId -> "<code> â€” <name>"` lookup map so
 * this page's own register table shows a real project name/code instead
 * of a raw UUID in its Project column â€” the same lookup-map reuse
 * `/budgeting/[id]/page.tsx`'s own `lineLabels` already established.
 *
 * `GET /project-risks` (`RiskController.findAll`) takes no `entityId` â€”
 * it's scoped entirely through `SecurityContextService.buildScope`
 * (RLS on `entity`/`businessUnit`), the same shape `security/page.tsx`
 * already established for an endpoint with no entity filter at all.
 * Unlike that page, though, `EntitySelector` IS still needed here â€”
 * `CreateRiskDto.entityId` is a required, `@RlsBodyCheck`-validated
 * body field the create form has to supply, even though the list
 * itself isn't filtered by it. So this page's own `entityId` only ever
 * flows into `CreateRiskForm`/the new `projects` fetch, never into the
 * risks list itself â€” worth stating plainly since every other page's
 * `entityId` does both.
 *
 * `GET /dashboard/pmo-risk-issue-overview` is called with no query
 * params at all â€” its own `projectId` filter is optional, and there's
 * no project selector on this page to supply one; its `entityId`
 * support that `RiskIssueService.getRiskIssueSummary` actually has
 * (read directly) isn't even reachable through the dashboard route,
 * which only forwards `projectId` â€” a pre-existing gap in that one
 * route, not something this checkpoint touches. Only `risksByStatus` is
 * used for the KPI section; `topOpenRisks`/`issuesByStatus`/
 * `openIssuesByPriority` are issue-related or redundant with this
 * page's own already-riskScore-sorted table, so they're left unused
 * rather than surfaced for the sake of it.
 *
 * ADDENDUM (FE-1.5) â€” `assignOwner`/`convertRiskToIssue`, named above
 * as deliberately left for a follow-on, are surfaced now: see the new
 * `RiskRowActions.tsx` (rendered as a second component in the Actions
 * cell, stacked below `CloseRiskButton`). `assess`/`mitigation-plan`/
 * `monitor` remain unsurfaced â€” a separate, workflow-progression-shaped
 * trio (`IDENTIFIED -> ASSESSED -> MITIGATING -> MONITORING`), a
 * genuinely different shape from the two "meaningful at any stage, no
 * sequencing" actions this checkpoint picked, worth its own checkpoint
 * rather than folded in here.
 *
 * ADDENDUM (FE-1.6) â€” `assess`/`mitigation-plan`/`monitor`, named just
 * above as still deferred, are surfaced now: see the new
 * `RiskWorkflowActions.tsx` (a third component stacked in the same
 * Actions cell, below `RiskRowActions`). This closes out `RiskController`
 * in full â€” every one of its actions now has frontend coverage.
 */
async function loadProjectRisks(entityId: string) {
  const [risks, overview, projects] = await Promise.all([
    fetchApi<ProjectRisk[]>('/project-risks'),
    fetchApi<PmoRiskIssueOverview>('/dashboard/pmo-risk-issue-overview'),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const closedCount = overview.risksByStatus.find((r) => r.status === 'CLOSED')?.count ?? 0;
  const totalCount = overview.risksByStatus.reduce((sum, r) => sum + r.count, 0);

  const projectOptions: SelectOption[] = projects.map((p) => ({ value: p.id, label: `${p.code} â€” ${p.name}` }));
  const projectNames = new Map(projects.map((p) => [p.id, `${p.code} â€” ${p.name}`]));

  return { risks, kpis: { total: totalCount, active: totalCount - closedCount, closed: closedCount }, projectOptions, projectNames };
}


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
            <ProjectRisksTable
              risks={data.risks}
              projectNames={Object.fromEntries(data.projectNames)}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
