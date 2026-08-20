import Link from 'next/link';
import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { CreateCycleForm } from './CreateCycleForm';
import { CycleStatusActions } from './CycleStatusActions';
import { SubmitSelfAssessmentForm } from './SubmitSelfAssessmentForm';
import { PerformanceCyclesTable, PerformanceReviewsTable } from './PerformanceTables';

export const dynamic = 'force-dynamic';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CALIBRATION' | 'CLOSED';
}

interface Review {
  id: string;
  employeeId: string;
  cycleId: string;
  status: 'DRAFT' | 'SELF_ASSESSMENT' | 'MANAGER_REVIEW' | 'PEER_REVIEW' | 'CALIBRATED' | 'COMPLETED';
  selfRating: number | null;
  managerRating: number | null;
  calibratedRating: number | null;
}

const CYCLE_TONE: Record<Cycle['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'positive',
  CALIBRATION: 'warning',
  CLOSED: 'neutral',
};

const REVIEW_TONE: Record<Review['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  PEER_REVIEW: 'warning',
  CALIBRATED: 'positive',
  COMPLETED: 'positive',
};

async function loadPerformance(entityId: string) {
  const [employees, cycles] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<Cycle[]>(`/hr/performance/cycles?entityId=${entityId}`),
  ]);

  const employeeOptions: SelectOption[] = employees.map((e) => ({ value: e.id, label: `${e.employeeCode} — ${e.firstName} ${e.lastName}` }));
  const cycleOptions: SelectOption[] = cycles.map((c) => ({ value: c.id, label: c.name }));
  const employeeNames = new Map(employees.map((e) => [e.id, `${e.employeeCode} — ${e.firstName} ${e.lastName}`]));

  // Reviews aren't entity-scoped server-side; fetch per cycle and merge.
  const reviewLists = await Promise.all(cycles.map((c) => fetchApi<Review[]>(`/hr/performance/reviews?cycleId=${c.id}`)));
  const reviews = reviewLists.flat();
  const cycleNames = new Map(cycles.map((c) => [c.id, c.name]));

  return {
    cycles,
    reviews,
    employeeOptions,
    cycleOptions,
    employeeNames,
    cycleNames,
    kpis: {
      openCycles: cycles.filter((c) => c.status === 'OPEN').length,
      inProgress: reviews.filter((r) => r.status !== 'COMPLETED').length,
      completed: reviews.filter((r) => r.status === 'COMPLETED').length,
    },
  };
}

export default async function PerformancePage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Performance" subtitle="Select an entity to manage performance cycles and reviews." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadPerformance>> | null = null;
  let error: string | null = null;
  try {
    data = await loadPerformance(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load performance data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Performance" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Open cycles" value={String(data.kpis.openCycles)} tone={data.kpis.openCycles > 0 ? 'positive' : 'neutral'} />
            <KpiCard label="Reviews in progress" value={String(data.kpis.inProgress)} tone={data.kpis.inProgress > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Reviews completed" value={String(data.kpis.completed)} tone="positive" />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Performance cycles" />
            <CreateCycleForm entityId={entityId} />
            <PerformanceCyclesTable rows={data.cycles} />
          </section>

          <section>
            <PageHeader title="Reviews" />
            <SubmitSelfAssessmentForm employeeOptions={data.employeeOptions} cycleOptions={data.cycleOptions} />
            <PerformanceReviewsTable rows={data.reviews} employeeNames={Object.fromEntries(data.employeeNames)} cycleNames={Object.fromEntries(data.cycleNames)} />
          </section>
        </>
      )}
          <section
        style={{
          marginTop: tokens.space(8),
          paddingTop: tokens.space(6),
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        <PageHeader
          title="Performance management"
          subtitle="Open goals, KPI, competency and assessment administration."
        />
        <Link
          href="/hr/performance/management"
          style={{
            color: tokens.color.textPrimary,
            fontFamily: tokens.font.body,
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          Open Performance Management →
        </Link>
      </section>
</PageContainer>
  );
}
