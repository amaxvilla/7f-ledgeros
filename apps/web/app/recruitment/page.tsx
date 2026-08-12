import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateVacancyForm } from './CreateVacancyForm';
import { CreateRequisitionForm } from './CreateRequisitionForm';
import { VacancyActions } from './VacancyActions';
import { RequisitionActions } from './RequisitionActions';
import { RetrySyncButton } from './RetrySyncButton';

export const dynamic = 'force-dynamic';

interface RecruiterDashboard {
  openVacancies: number;
  pendingRequisitions: number;
  upcomingInterviews: number;
  calendarSyncFailures: number;
  teamsSyncFailures: number;
  pipelineByStage: { stage: string; count: number }[];
}

interface Vacancy {
  id: string;
  title: string;
  status: string;
  _count: { applications: number };
}

interface JobRequisition {
  id: string;
  jobTitle: string;
  status: string;
  headcount: number;
  workflowInstanceId: string | null;
  vacancies: { id: string }[];
}

interface PipelineReportRow {
  vacancyId: string;
  title: string;
  status: string;
  totalApplications: number;
  hired: number;
  rejected: number;
  avgTimeToHireDays: number | null;
}

interface InterviewSyncFailure {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  jobApplication: { candidate: { firstName: string; lastName: string } | null } | null;
}

interface CandidateSyncFailure {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface OfferSyncFailure {
  id: string;
  jobTitle: string;
  status: string;
  sentAt: string | null;
}

async function loadRecruitment(entityId: string) {
  const [dashboard, requisitions, vacancies, pipeline, calendarSyncFailures, teamsSyncFailures, contactSyncFailures, signatureSyncFailures] =
    await Promise.all([
      fetchApi<RecruiterDashboard>(`/recruitment/dashboard?entityId=${entityId}`),
      fetchApi<JobRequisition[]>(`/recruitment/requisitions?entityId=${entityId}`),
      fetchApi<Vacancy[]>(`/recruitment/vacancies?entityId=${entityId}`),
      fetchApi<PipelineReportRow[]>(`/recruitment/reports/pipeline?entityId=${entityId}`),
      fetchApi<InterviewSyncFailure[]>(`/recruitment/interviews/calendar-sync/failures?entityId=${entityId}`),
      fetchApi<InterviewSyncFailure[]>(`/recruitment/interviews/teams-sync/failures?entityId=${entityId}`),
      fetchApi<CandidateSyncFailure[]>(`/recruitment/candidates/contact-sync/failures?entityId=${entityId}`),
      fetchApi<OfferSyncFailure[]>(`/recruitment/offers/signature-sync/failures`),
    ]);
  return {
    dashboard,
    requisitions,
    vacancies,
    pipeline,
    calendarSyncFailures,
    teamsSyncFailures,
    contactSyncFailures,
    signatureSyncFailures,
  };
}

/**
 * Frontend Completion, Checkpoint B — the second Module Page (after the
 * finance dashboard at `/`), and the first real link in AppShell's own
 * nav (see layout.tsx). Recruitment was picked as the first module
 * because it's the most fully-built backend domain audited across this
 * session's recent checkpoints (requisitions -> vacancies ->
 * applications -> interviews -> offers -> e-signature, plus its own
 * dashboard/reports/pipeline endpoints already shaped for exactly this
 * use) — building against a thin domain would have meant inventing UI
 * for endpoints that don't exist yet.
 *
 * Same architecture as the finance dashboard at `/`: an async Server
 * Component, one Promise.all of fetchApi calls, no client-side state.
 * Deliberately does NOT introduce a client-side data layer (React
 * Query, SWR, etc.) — with exactly two module pages now existing, that
 * infrastructure decision is premature; the same server-fetch pattern
 * this codebase already established is reused instead of introducing a
 * second one.
 *
 * Frontend Completion — this page's first write path: CreateVacancyForm
 * (see that component's own doc comment), added once the rest of this
 * app had already established a consistent form-per-page convention
 * across six other pages. Recruitment's own read side was left
 * untouched — same "additive, don't touch what already works" posture
 * every prior form checkpoint has followed for the read side of its own
 * page.
 *
 * Checkpoint AH: `data.requisitions` (already fetched above for the
 * "Job requisitions" table) is filtered to `status === 'APPROVED'` and
 * passed into `CreateVacancyForm` as `requisitions` — this page does
 * the filtering, not the component, so `CreateVacancyForm` stays a pure
 * renderer of whatever list it's given (see its own doc comment).
 *
 * ADDENDUM — Recruitment "needs attention" sync-failures panel: four
 * new fetches (calendar/Teams/contact/signature), one new section with
 * four small sub-tables, each row backed by `RetrySyncButton` (see that
 * component's own doc comment for the full backend investigation this
 * checkpoint did, including why the domain-scoped routes were used
 * instead of `DashboardController`'s duplicate wrappers). The existing
 * "Sync failures" `KpiCard` above (`calendarSyncFailures +
 * teamsSyncFailures`, present since Checkpoint B) is UNCHANGED and NOT
 * redundant with this new section — confirmed directly that
 * `RecruiterDashboard`'s own count query and `findWithFailedCalendarSync`/
 * `findWithFailedTeamsSync`'s own list query use character-for-character
 * identical `where` clauses, so the KPI number and this new section's
 * row counts will always agree; the KPI stays a summary, this section
 * is its first-ever detail/action view. Contact-sync and signature-sync
 * failures were never counted in that KPI at all (confirmed directly —
 * `recruiterDashboard` only ever queried calendar/Teams) — this
 * checkpoint doesn't retrofit the KPI to include them, since doing so
 * would be a separate, un-asked-for change to an already-shipped
 * metric; it only adds their own detail sections alongside it.
 */
export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Recruitment" subtitle="Enter an entity ID to view its recruitment pipeline." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadRecruitment>> | null = null;
  let error: string | null = null;
  try {
    data = await loadRecruitment(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load recruitment data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Recruitment" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
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
            <KpiCard label="Open vacancies" value={String(data.dashboard.openVacancies)} />
            <KpiCard label="Pending requisitions" value={String(data.dashboard.pendingRequisitions)} tone="warning" />
            <KpiCard label="Upcoming interviews" value={String(data.dashboard.upcomingInterviews)} tone="positive" />
            <KpiCard
              label="Sync failures"
              value={String(data.dashboard.calendarSyncFailures + data.dashboard.teamsSyncFailures)}
              tone={data.dashboard.calendarSyncFailures + data.dashboard.teamsSyncFailures > 0 ? 'negative' : 'positive'}
              caption="calendar + Teams"
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Pipeline by stage" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {data.dashboard.pipelineByStage.length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No applications in the pipeline yet.
                </span>
              )}
              {data.dashboard.pipelineByStage.map((s) => (
                <Badge key={s.stage} tone="neutral">
                  {s.stage}: {s.count}
                </Badge>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Job requisitions" />
            <CreateRequisitionForm entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Requisition', render: (r: JobRequisition) => r.jobTitle },
                {
                  header: 'Status',
                  render: (r: JobRequisition) => (
                    <Badge
                      tone={
                        r.status === 'APPROVED'
                          ? 'positive'
                          : r.status === 'REJECTED'
                            ? 'negative'
                            : r.status === 'CLOSED'
                              ? 'neutral'
                              : 'warning'
                      }
                    >
                      {r.status}
                    </Badge>
                  ),
                },
                { header: 'Headcount', align: 'right', render: (r: JobRequisition) => String(r.headcount) },
                { header: 'Vacancies', align: 'right', render: (r: JobRequisition) => String(r.vacancies.length) },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (r: JobRequisition) => (
                    <RequisitionActions id={r.id} status={r.status} hasWorkflowInstance={r.workflowInstanceId !== null} />
                  ),
                },
              ]}
              rows={data.requisitions}
              keyOf={(r) => r.id}
              emptyMessage="No job requisitions for this entity yet."
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Open vacancies" />
            <CreateVacancyForm
              entityId={entityId}
              requisitions={data.requisitions
                .filter((r) => r.status === 'APPROVED')
                .map((r) => ({ id: r.id, jobTitle: r.jobTitle }))}
            />
            <DataTable
              columns={[
                { header: 'Vacancy', render: (r: Vacancy) => r.title },
                {
                  header: 'Status',
                  render: (r: Vacancy) => (
                    <Badge tone={r.status === 'OPEN' ? 'positive' : r.status === 'CLOSED' ? 'neutral' : 'warning'}>{r.status}</Badge>
                  ),
                },
                { header: 'Applications', align: 'right', render: (r: Vacancy) => String(r._count.applications) },
                { header: 'Actions', align: 'right', render: (r: Vacancy) => <VacancyActions id={r.id} status={r.status} /> },
              ]}
              rows={data.vacancies}
              keyOf={(r) => r.id}
              emptyMessage="No vacancies for this entity yet."
            />
          </section>

          <section>
            <PageHeader title="Time-to-hire & conversion" />
            <DataTable
              columns={[
                { header: 'Vacancy', render: (r: PipelineReportRow) => r.title },
                { header: 'Applications', align: 'right', render: (r: PipelineReportRow) => String(r.totalApplications) },
                { header: 'Hired', align: 'right', render: (r: PipelineReportRow) => String(r.hired) },
                { header: 'Rejected', align: 'right', render: (r: PipelineReportRow) => String(r.rejected) },
                {
                  header: 'Avg. time to hire',
                  align: 'right',
                  render: (r: PipelineReportRow) => (r.avgTimeToHireDays === null ? '—' : `${r.avgTimeToHireDays}d`),
                },
              ]}
              rows={data.pipeline}
              keyOf={(r) => r.vacancyId}
              emptyMessage="No vacancies for this entity yet."
            />
          </section>

          <section>
            <PageHeader title="Needs attention — sync failures" subtitle="Retry a failed sync directly from its row." />

            <div style={{ marginBottom: tokens.space(6) }}>
              <PageHeader title="Calendar sync" />
              <DataTable
                columns={[
                  {
                    header: 'Interview',
                    render: (r: InterviewSyncFailure) =>
                      r.jobApplication?.candidate ? `${r.title} — ${r.jobApplication.candidate.firstName} ${r.jobApplication.candidate.lastName}` : r.title,
                  },
                  { header: 'Scheduled', render: (r: InterviewSyncFailure) => new Date(r.scheduledAt).toLocaleString() },
                  { header: 'Status', render: (r: InterviewSyncFailure) => <Badge tone="warning">{r.status}</Badge> },
                  { header: 'Actions', align: 'right', render: (r: InterviewSyncFailure) => <RetrySyncButton id={r.id} kind="calendar" /> },
                ]}
                rows={data.calendarSyncFailures}
                keyOf={(r) => r.id}
                emptyMessage="No calendar sync failures."
              />
            </div>

            <div style={{ marginBottom: tokens.space(6) }}>
              <PageHeader title="Teams sync" />
              <DataTable
                columns={[
                  {
                    header: 'Interview',
                    render: (r: InterviewSyncFailure) =>
                      r.jobApplication?.candidate ? `${r.title} — ${r.jobApplication.candidate.firstName} ${r.jobApplication.candidate.lastName}` : r.title,
                  },
                  { header: 'Scheduled', render: (r: InterviewSyncFailure) => new Date(r.scheduledAt).toLocaleString() },
                  { header: 'Status', render: (r: InterviewSyncFailure) => <Badge tone="warning">{r.status}</Badge> },
                  { header: 'Actions', align: 'right', render: (r: InterviewSyncFailure) => <RetrySyncButton id={r.id} kind="teams" /> },
                ]}
                rows={data.teamsSyncFailures}
                keyOf={(r) => r.id}
                emptyMessage="No Teams sync failures."
              />
            </div>

            <div style={{ marginBottom: tokens.space(6) }}>
              <PageHeader title="Contact sync" />
              <DataTable
                columns={[
                  { header: 'Candidate', render: (r: CandidateSyncFailure) => `${r.firstName} ${r.lastName}` },
                  { header: 'Email', render: (r: CandidateSyncFailure) => r.email },
                  { header: 'Actions', align: 'right', render: (r: CandidateSyncFailure) => <RetrySyncButton id={r.id} kind="contact" /> },
                ]}
                rows={data.contactSyncFailures}
                keyOf={(r) => r.id}
                emptyMessage="No contact sync failures."
              />
            </div>

            <div>
              <PageHeader title="Signature sync" />
              <DataTable
                columns={[
                  { header: 'Offer', render: (r: OfferSyncFailure) => r.jobTitle },
                  { header: 'Status', render: (r: OfferSyncFailure) => <Badge tone="warning">{r.status}</Badge> },
                  { header: 'Sent', render: (r: OfferSyncFailure) => (r.sentAt ? new Date(r.sentAt).toLocaleString() : '—') },
                  { header: 'Actions', align: 'right', render: (r: OfferSyncFailure) => <RetrySyncButton id={r.id} kind="signature" /> },
                ]}
                rows={data.signatureSyncFailures}
                keyOf={(r) => r.id}
                emptyMessage="No signature sync failures."
              />
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
