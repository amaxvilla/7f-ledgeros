import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { ProjectSelector } from '../ProjectSelector';
import type { ProjectOption } from '../ProjectSelector';
import {
  PmoTaskTable,
  PmoStatusTable,
  PmoTopRiskTable,
  PmoPriorityTable,
} from './PmoTables';

export const dynamic = 'force-dynamic';

interface GanttTask {
  id: string;
  parentTaskId: string | null;
  name: string;
  start: string;
  end: string;
  percentComplete: number;
  isMilestone: boolean;
  isCritical: boolean;
  status: string;
}

interface EarnedValue {
  projectId: string;
  asOfDate: string;
  taskCount: number;
  PV: number;
  EV: number;
  AC: number;
  SV: number;
  CV: number;
  SPI: number | null;
  CPI: number | null;
}

interface ProjectPerformance {
  entityId: string;
  projectId: string;
  schedule: { tasks: GanttTask[]; dependencies: unknown[] };
  earnedValue: EarnedValue;
}

interface StatusCount {
  status: string;
  count: number;
}

interface TopOpenRisk {
  id: string;
  title: string;
  riskScore: number;
  status: string;
}

interface PriorityCount {
  priority: string;
  count: number;
}

interface RiskIssueRegister {
  entityId: string;
  projectId?: string;
  risksByStatus: StatusCount[];
  topOpenRisks: TopOpenRisk[];
  issuesByStatus: StatusCount[];
  openIssuesByPriority: PriorityCount[];
}

interface PmoAnalytics {
  projectPerformance: ProjectPerformance;
  riskIssueRegister: RiskIssueRegister;
}

const TASK_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  ON_HOLD: 'warning',
  CANCELLED: 'negative',
};

/** SPI/CPI: null when there's nothing to divide by yet (`PV`/`AC` of zero, `ReportingService.pmoProjectPerformance`'s own guard) â€” "â€”", not "0.00" or "N/A", the same "â€”" degradation `executive/page.tsx`'s own `ratio()` helper already established for a null financial-ratio cell. */
function index(v: number | null): string {
  return v === null ? 'â€”' : v.toFixed(2);
}

/**
 * Frontend Completion â€” PMO Dashboard (`/pmo`), the direct follow-on to
 * this checkpoint's own `ProjectSelector` (see that component's doc
 * comment for why a Projects registry â€” wrongly believed absent by an
 * earlier checkpoint's own doc comment â€” was the actual blocker, not a
 * missing endpoint on `DashboardController` itself). This is the same
 * checkpoint as the selector, not a separate one â€” small enough
 * together to stay within "2-3 closely related pages/components," and
 * the selector has no other consumer yet to justify shipping it alone.
 *
 * `GET /dashboard/pmo-analytics` (`DashboardService.getPmoAnalyticsOverview`,
 * `pmo.view`) takes `entityId` AND `projectId` BOTH REQUIRED (confirmed
 * directly, no `?` on either in the controller signature) â€” this page
 * is gated on both being present, with `EntitySelector` (existing) and
 * `ProjectSelector` (new) as the two-step path to get there, rather
 * than a single combined picker: `ProjectSelector`'s own options list
 * itself depends on `entityId` already being chosen (`GET /dimensions
 * /projects?entityId=X`), so the two pickers are already a genuine
 * two-step flow at the data level, not an arbitrary UI split.
 *
 * TWO GENUINELY DIFFERENT SOURCES COMBINED, READ DIRECTLY RATHER THAN
 * ASSUMED FROM THE ENDPOINT NAME: `projectPerformance`
 * (`ReportingService.pmoProjectPerformance`, itself `getGanttData` +
 * `computeEarnedValue`) is genuinely project-scoped with no "all
 * projects" mode â€” `computeEarnedValue`'s own PV/EV/AC math only makes
 * sense for one project's own tasks. `riskIssueRegister`
 * (`pmoRiskIssueRegister`) is ACTUALLY project-OPTIONAL at the
 * `ReportingService` layer (confirmed directly: `projectId?: string`)
 * â€” this endpoint just always passes one through since the controller
 * itself requires it â€” worth naming since a future "all-projects risk
 * register" page could reuse the same service method without a project
 * selected at all, unlike `projectPerformance`.
 *
 * Earned-value terms (PV/EV/AC/SV/CV/SPI/CPI) are shown with their
 * standard abbreviations as KPI labels, each with a plain-English
 * caption â€” this app has no glossary/tooltip component anywhere to
 * lean on instead, and every other dashboard page's own KPI labels are
 * already domain-jargon-forward (e.g. `executive/page.tsx`'s own
 * "Debt to equity", "Cash conversion cycle").
 *
 * No forms, no new Server Action â€” same read-only-dashboard scope every
 * FE-2 page has had. Gantt-chart rendering itself (the `dependencies`
 * array, task hierarchy) is deliberately NOT attempted here â€” a real
 * Gantt view is its own visualization checkpoint; the Tasks table below
 * shows the same task list flattened, without the chart.
 */
async function loadProjectOptions(entityId: string): Promise<ProjectOption[]> {
  return fetchApi<ProjectOption[]>(`/dimensions/projects?entityId=${entityId}`);
}

async function loadPmoAnalytics(entityId: string, projectId: string): Promise<PmoAnalytics> {
  return fetchApi<PmoAnalytics>(`/dashboard/pmo-analytics?entityId=${entityId}&projectId=${projectId}`);
}

export default async function PmoDashboardPage({
  searchParams,
}: {
  searchParams: { entityId?: string; projectId?: string };
}) {
  const entityId = searchParams.entityId;
  const projectId = searchParams.projectId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="PMO" subtitle="Enter an entity ID to view its projects." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let projectOptions: ProjectOption[] = [];
  let projectOptionsError: string | null = null;
  try {
    projectOptions = await loadProjectOptions(entityId);
  } catch (e) {
    projectOptionsError = e instanceof ApiError ? e.message : 'Failed to load projects for this entity.';
  }

  if (!projectId) {
    return (
      <PageContainer>
        <PageHeader title="PMO" subtitle={`Entity ${entityId} â€” choose a project to view its dashboard.`} />
        <EntitySelector initialValue={entityId} />
        {projectOptionsError ? (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{projectOptionsError}</div>
        ) : (
          <ProjectSelector entityId={entityId} projectOptions={projectOptions} />
        )}
      </PageContainer>
    );
  }

  let data: PmoAnalytics | null = null;
  let error: string | null = null;
  try {
    data = await loadPmoAnalytics(entityId, projectId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load PMO dashboard data.';
  }

  const selectedProject = projectOptions.find((p) => p.id === projectId);

  return (
    <PageContainer>
      <PageHeader title="PMO" subtitle={selectedProject ? `${selectedProject.code} â€” ${selectedProject.name}` : `Project ${projectId}`} />
      <EntitySelector initialValue={entityId} />
      <ProjectSelector entityId={entityId} projectOptions={projectOptions} initialValue={projectId} />

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
            <KpiCard label="Planned value (PV)" value={formatCurrency(data.projectPerformance.earnedValue.PV)} />
            <KpiCard label="Earned value (EV)" value={formatCurrency(data.projectPerformance.earnedValue.EV)} />
            <KpiCard label="Actual cost (AC)" value={formatCurrency(data.projectPerformance.earnedValue.AC)} />
            <KpiCard
              label="Schedule variance (SV)"
              value={formatCurrency(data.projectPerformance.earnedValue.SV)}
              tone={data.projectPerformance.earnedValue.SV >= 0 ? 'positive' : 'negative'}
            />
            <KpiCard
              label="Cost variance (CV)"
              value={formatCurrency(data.projectPerformance.earnedValue.CV)}
              tone={data.projectPerformance.earnedValue.CV >= 0 ? 'positive' : 'negative'}
            />
            <KpiCard
              label="SPI"
              value={index(data.projectPerformance.earnedValue.SPI)}
              caption="Schedule performance index"
              tone={
                data.projectPerformance.earnedValue.SPI === null ? 'neutral' : data.projectPerformance.earnedValue.SPI >= 1 ? 'positive' : 'warning'
              }
            />
            <KpiCard
              label="CPI"
              value={index(data.projectPerformance.earnedValue.CPI)}
              caption="Cost performance index"
              tone={
                data.projectPerformance.earnedValue.CPI === null ? 'neutral' : data.projectPerformance.earnedValue.CPI >= 1 ? 'positive' : 'warning'
              }
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Tasks" subtitle={`${data.projectPerformance.earnedValue.taskCount} total, as of ${new Date(data.projectPerformance.earnedValue.asOfDate).toLocaleDateString()}`} />
            <PmoTaskTable rows={data.projectPerformance.schedule.tasks} />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: tokens.space(6), marginBottom: tokens.space(8) }}>
            <div>
              <PageHeader title="Risks by status" />
              <PmoStatusTable
                rows={data.riskIssueRegister.risksByStatus}
                emptyMessage="No risks logged for this project."
              />
            </div>
            <div>
              <PageHeader title="Issues by status" />
              <PmoStatusTable
                rows={data.riskIssueRegister.issuesByStatus}
                emptyMessage="No issues logged for this project."
              />
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Top open risks" />
            <PmoTopRiskTable rows={data.riskIssueRegister.topOpenRisks} />
          </section>

          <section>
            <PageHeader title="Open issues by priority" />
            <PmoPriorityTable rows={data.riskIssueRegister.openIssuesByPriority} />
          </section>
        </>
      )}
    </PageContainer>
  );
}

