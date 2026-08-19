import Link from 'next/link';
import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { ManagerReviewForm } from './ManagerReviewForm';
import { PeerFeedbackForm } from './PeerFeedbackForm';
import { CalibrateForm } from './CalibrateForm';

export const dynamic = 'force-dynamic';

interface Review {
  id: string;
  employeeId: string;
  cycleId: string;
  status: 'DRAFT' | 'SELF_ASSESSMENT' | 'MANAGER_REVIEW' | 'PEER_REVIEW' | 'CALIBRATED' | 'COMPLETED';
  selfRating: number | null;
  selfComments: string | null;
  managerRating: number | null;
  managerComments: string | null;
  peerComments: string | null;
  calibratedRating: number | null;
  promotionRecommended: boolean;
  pipRequired: boolean;
}

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface Cycle {
  id: string;
  name: string;
}

const STATUS_TONE: Record<Review['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  PEER_REVIEW: 'warning',
  CALIBRATED: 'positive',
  COMPLETED: 'positive',
};

/**
 * `PerformanceController` has no single-review GET route — only the
 * filterable list (`GET /hr/performance/reviews`) and per-employee
 * history. Fetching the unfiltered list and finding this review by id
 * is the only way to load one review's full detail without adding a
 * backend route this checkpoint isn't scoped to add.
 */
async function loadReview(id: string) {
  const reviews = await fetchApi<Review[]>('/hr/performance/reviews');
  const review = reviews.find((r) => r.id === id);
  if (!review) return null;

  const [employee, cycles] = await Promise.all([
    fetchApi<Employee>(`/hr/employees/${review.employeeId}`),
    fetchApi<Cycle[]>('/hr/performance/cycles'),
  ]);
  const cycle = cycles.find((c) => c.id === review.cycleId);

  return { review, employee, cycleName: cycle?.name ?? review.cycleId };
}

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof loadReview>> = null;
  let error: string | null = null;

  try {
    data = await loadReview(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load review.';
  }

  if (error || !data) {
    return (
      <PageContainer>
        <PageHeader title="Performance Review" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Review not found.'}</div>
        <Link href="/hr/performance" style={{ color: tokens.color.accent, fontFamily: tokens.font.body }}>
          ← Back to performance
        </Link>
      </PageContainer>
    );
  }

  const { review, employee, cycleName } = data;

  return (
    <PageContainer>
      <PageHeader title={`${employee.firstName} ${employee.lastName}`} subtitle={`${cycleName} · ${employee.employeeCode}`} />
      <Link href="/hr/performance" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
        ← Back to performance
      </Link>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: tokens.space(4),
          margin: `${tokens.space(6)} 0 ${tokens.space(8)}`,
        }}
      >
        <KpiCard label="Status" value={review.status} tone={STATUS_TONE[review.status]} />
        <KpiCard label="Self rating" value={review.selfRating != null ? String(review.selfRating) : '—'} />
        <KpiCard label="Manager rating" value={review.managerRating != null ? String(review.managerRating) : '—'} />
        <KpiCard label="Calibrated rating" value={review.calibratedRating != null ? String(review.calibratedRating) : '—'} />
      </section>

      {(review.selfComments || review.managerComments || review.peerComments) && (
        <section style={{ marginBottom: tokens.space(8), display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
          {review.selfComments && (
            <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
              <strong>Self comments:</strong> {review.selfComments}
            </div>
          )}
          {review.managerComments && (
            <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
              <strong>Manager comments:</strong> {review.managerComments}
            </div>
          )}
          {review.peerComments && (
            <div style={{ fontFamily: tokens.font.body, fontSize: '13px', whiteSpace: 'pre-wrap' }}>
              <strong>Peer feedback:</strong> {review.peerComments}
            </div>
          )}
          <div style={{ display: 'flex', gap: tokens.space(2) }}>
            {review.promotionRecommended && <Badge tone="positive">Promotion recommended</Badge>}
            {review.pipRequired && <Badge tone="negative">PIP required</Badge>}
          </div>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(6) }}>
        {review.status === 'SELF_ASSESSMENT' && (
          <div>
            <PageHeader title="Manager review" />
            <ManagerReviewForm reviewId={review.id} />
          </div>
        )}

        {(review.status === 'MANAGER_REVIEW' || review.status === 'PEER_REVIEW') && (
          <div>
            <PageHeader title="Peer feedback" />
            <PeerFeedbackForm reviewId={review.id} />
          </div>
        )}

        {(review.status === 'MANAGER_REVIEW' || review.status === 'PEER_REVIEW' || review.status === 'CALIBRATED') && (
          <div>
            <PageHeader title="Calibration" />
            <CalibrateForm reviewId={review.id} hasCalibratedRating={review.calibratedRating != null} />
          </div>
        )}

        {review.status === 'COMPLETED' && (
          <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
            This review is complete.
          </div>
        )}
      </section>
    </PageContainer>
  );
}
