import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { TriggerDashboardRefreshForm } from './TriggerDashboardRefreshForm';
import { TriggerBudgetRecalculationForm } from './TriggerBudgetRecalculationForm';
import { TriggerReportGenerationForm } from './TriggerReportGenerationForm';

export const dynamic = 'force-dynamic';

interface JobRun {
  id: string;
  queueName: string;
  jobName: string;
  jobId: string;
  status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  attemptsMade: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  result: { url?: string } | null;
}

/**
 * `result.url` (`JobRunLog.result`, a `Json?` column — confirmed
 * directly `JobRunsController.list()` has no `select`, so it already
 * comes back on every row, not a new backend change) is API-relative
 * (`LocalDiskStorageProvider`'s own `publicBasePath`, `/api/v1/storage/
 * files/...`) — resolved against the API's own origin here, not the
 * Next.js app's, since `fetchApi`'s `API_URL` already points at a
 * separate host/port in this environment.
 */
function resolveResultUrl(url: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  return `${new URL(apiUrl).origin}${url}`;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  QUEUED: 'neutral',
  ACTIVE: 'warning',
  COMPLETED: 'positive',
  FAILED: 'negative',
};

/**
 * Frontend Completion, FE-8.5 — Queue (`/queue`). See `actions.ts`'s own
 * doc comment for the full scoping rationale (why Queue over Workflow/
 * Notifications/Monitoring/Storage, and why only 2 of the 4 trigger
 * endpoints are surfaced here).
 *
 * `GET /job-runs` (confirmed directly against `JobRunsController`) is
 * NOT entity-scoped — no `EntitySelector` gate, unlike most other pages
 * in this app; it's a system-wide operational register, the same
 * un-scoped shape `/security`'s own page already established for a
 * similarly cross-entity concern. Called with no query params, so the
 * backend's own default (`take: Math.min(Number(limit) || 50, 200)` →
 * 50) applies — a `queueName`/`status` filter UI is real, separate
 * follow-on work (the endpoint already supports it), not attempted this
 * checkpoint to keep this slice to its own "2-3 related components."
 *
 * KPI counts are computed CLIENT-side from the same 50-row response,
 * not a second endpoint call — same "don't add a fetch for something
 * derivable from data already in hand" discipline this app's other
 * pages already follow. This means the KPI cards summarize only the 50
 * most recent runs shown, not the true all-time total — noted via each
 * card's own caption rather than left ambiguous.
 *
 * ADDENDUM (FC-3.1) — Report Generation. Adds the third of
 * `JobsController`'s four trigger forms (see `actions.ts`'s own doc
 * comment) plus a Result column so a completed report-generation run's
 * download link is actually reachable — before this, `result` came back
 * from the API on every row already but was never read.
 */
async function loadJobRuns() {
  return fetchApi<JobRun[]>('/job-runs');
}

export default async function QueuePage() {
  let jobRuns: JobRun[] = [];
  let error: string | null = null;
  try {
    jobRuns = await loadJobRuns();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load job runs.';
  }

  const statusCounts = jobRuns.reduce<Record<string, number>>((acc, run) => {
    acc[run.status] = (acc[run.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageContainer>
      <PageHeader title="Job Queue" subtitle="Background job triggers and recent run history" />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Queued" value={String(statusCounts.QUEUED ?? 0)} caption="of last 50 runs" />
        <KpiCard label="Active" value={String(statusCounts.ACTIVE ?? 0)} tone="warning" caption="of last 50 runs" />
        <KpiCard label="Completed" value={String(statusCounts.COMPLETED ?? 0)} tone="positive" caption="of last 50 runs" />
        <KpiCard label="Failed" value={String(statusCounts.FAILED ?? 0)} tone={statusCounts.FAILED ? 'negative' : 'neutral'} caption="of last 50 runs" />
      </section>

      <TriggerDashboardRefreshForm />
      <TriggerBudgetRecalculationForm />
      <TriggerReportGenerationForm />

      <DataTable
        columns={[
          { header: 'Queue', render: (j: JobRun) => j.queueName },
          { header: 'Job', render: (j: JobRun) => j.jobName },
          { header: 'Status', render: (j: JobRun) => <Badge tone={STATUS_TONE[j.status] ?? 'neutral'}>{j.status}</Badge> },
          { header: 'Attempts', align: 'right', render: (j: JobRun) => String(j.attemptsMade) },
          { header: 'Error', render: (j: JobRun) => j.errorMessage ?? '—' },
          {
            header: 'Result',
            render: (j: JobRun) =>
              j.result?.url ? (
                <a href={resolveResultUrl(j.result.url)} style={{ color: tokens.color.accent }} target="_blank" rel="noreferrer">
                  Download
                </a>
              ) : (
                '—'
              ),
          },
          { header: 'Created', render: (j: JobRun) => new Date(j.createdAt).toLocaleString() },
        ]}
        rows={jobRuns}
        keyOf={(j) => j.id}
        emptyMessage="No job runs recorded yet."
      />
    </PageContainer>
  );
}
