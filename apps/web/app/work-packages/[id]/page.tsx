import Link from 'next/link';
import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { CreateProgressValuationForm } from './CreateProgressValuationForm';
import { ProgressValuationStatusActions } from './ProgressValuationStatusActions';
import { GenerateCertificateForm } from './GenerateCertificateForm';
import { CertificateStatusActions } from './CertificateStatusActions';
import { ReleaseRetentionForm } from './ReleaseRetentionForm';
import { CreateVariationOrderForm } from './CreateVariationOrderForm';
import { VariationOrderStatusActions } from './VariationOrderStatusActions';
import {
  ProgressValuationsTable,
  RetentionReleasesTable,
  VariationOrdersTable,
} from './WorkPackageDetailTables';

export const dynamic = 'force-dynamic';

interface WorkPackage {
  id: string;
  projectId: string;
  contractorId: string;
  code: string;
  name: string;
  description: string | null;
  budgetAmount: number;
  status: string;
  createdAt: string;
  contractor: { id: string; vendor: { id: string; name: string } };
}

interface ProgressValuation {
  id: string;
  workPackageId: string;
  valuationNumber: number;
  valuationDate: string;
  percentComplete: number;
  valuationAmount: number;
  status: string;
  certificate: {
    id: string;
    certificateNumber: string;
    status: string;
    netPayableAmount: number;
  } | null;
}

interface RetentionRelease {
  id: string;
  amount: number;
  releaseDate: string;
}

interface Retention {
  id: string;
  retentionPercent: number;
  totalHeld: number;
  totalReleased: number;
  releases: RetentionRelease[];
}

interface VariationOrder {
  id: string;
  voNumber: string;
  description: string;
  amount: number;
  status: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'positive',
  CERTIFIED: 'positive',
  REJECTED: 'negative',
};

/**
 * Frontend Completion, PMO.3 — Work Package detail (`/work-packages/[id]`),
 * the direct continuation of PMO.2 (recommended explicitly by its own
 * report) and the third link in PMO's own BOQ -> Work Package -> Progress
 * Valuation -> Interim Payment Certificate chain.
 *
 * NO `GET /pmo/work-packages/:id` SINGLE-ITEM ENDPOINT EXISTS — confirmed
 * directly by grepping every `@Get` route in `pmo.controller.ts` (only
 * the list endpoint, `GET /pmo/work-packages`, exists). This page
 * therefore fetches the full RLS-scoped list (same no-query-param call
 * `/work-packages` itself already makes) and finds the matching row by
 * id, the same "confirm directly, don't assume a shape" discipline this
 * codebase applies throughout rather than guessing at an endpoint that
 * doesn't exist. `GET /pmo/work-packages/:workPackageId/progress-valuations`
 * DOES exist and is fetched directly with the route's own `id` param.
 *
 * `projectId` is shown as a raw id, not resolved to a project name —
 * unlike the register page, this detail page has no `entityId` in its
 * URL to scope a `GET /dimensions/projects?entityId=` call with, and
 * fetching every project across every entity just to resolve one label
 * would be a real, unscoped widening of this checkpoint. Same posture
 * `project-risks`/`project-issues` already take toward their own
 * unresolved `projectId` fields (see those pages' own doc comments).
 *
 * Both endpoints require only `pmo.view` (confirmed directly against
 * their own `@RequirePermissions` decorators) — same permission
 * `/work-packages` itself already gates on, so no new permission
 * surface is introduced here.
 *
 * Addendum — Interim Payment Certificates: the "Certificate" column
 * now renders one of three states per row rather than a static badge —
 * `GenerateCertificateForm` (APPROVED, no certificate yet), a dash
 * (any other status, no certificate), or the certificate's own number/
 * status/net-payable-amount plus `CertificateStatusActions` (a
 * certificate already exists). `certificate` was widened from `{id}`
 * to its full shape used here — `findProgressValuations`'s own
 * `include: { certificate: true }` (read directly) already returns all
 * of it, this page just wasn't using more than the id before this
 * checkpoint.
 *
 * Addendum — Retention: `GET /pmo/work-packages/:workPackageId/retention`
 * (`PmoService.getRetention`, `pmo.view`) throws `NotFoundException`
 * until the first certificate on this work package is `CERTIFIED`
 * (confirmed directly — `advanceCertificateStatus`'s own `CERTIFIED`
 * branch is what creates the `Retention` row) — a real, expected 404,
 * not an error state. Fetched in its own separate `try/catch` outside
 * `loadWorkPackageDetail`'s own `Promise.all` for exactly that reason:
 * folding it into the same `Promise.all` would turn every work package
 * without a certified certificate yet into this whole page's error
 * state, which `ApiError`'s own `status` field exists to let this page
 * distinguish from a genuine failure. `retentionAvailable` (`totalHeld -
 * totalReleased`) is computed here, not requested from the backend,
 * matching `releaseRetention`'s own identical arithmetic (read directly)
 * — this page's own copy is display-only and never sent back.
 *
 * Addendum — Variation Orders (following FE-5.5's own recommendation,
 * from the fixed-and-reverified baseline FIX.4 established):
 * `GET /pmo/work-packages/:workPackageId/variation-orders`
 * (`PmoService.findVariationOrders`, `pmo.view`) takes no status
 * filter and always returns an array (empty, not a 404, for a work
 * package with none yet — confirmed directly, unlike Retention's own
 * 404-until-certified shape) — added to `loadWorkPackageDetail`'s own
 * `Promise.all` alongside `workPackages`/`valuations`, not a separate
 * `try/catch` the way Retention needed. Rendered as its own section
 * (`CreateVariationOrderForm` + a register `DataTable`), the same
 * "form above the table" placement `Progress valuations` already uses,
 * not a per-row inline form the way certificate generation is — see
 * `CreateVariationOrderForm.tsx`'s own doc comment for why, and for a
 * real, notable backend gap this checkpoint found and flagged rather
 * than silently working around (`CreateVariationOrderDto` has no
 * server-side request validation at all).
 */
async function loadWorkPackageDetail(id: string) {
  const [workPackages, valuations, variationOrders] = await Promise.all([
    fetchApi<WorkPackage[]>('/pmo/work-packages'),
    fetchApi<ProgressValuation[]>(`/pmo/work-packages/${id}/progress-valuations`),
    fetchApi<VariationOrder[]>(`/pmo/work-packages/${id}/variation-orders`),
  ]);

  const workPackage = workPackages.find((wp) => wp.id === id);
  if (!workPackage) return null;

  const latest = valuations.length > 0 ? valuations[valuations.length - 1] : null;

  let retention: Retention | null = null;
  try {
    retention = await fetchApi<Retention>(`/pmo/work-packages/${id}/retention`);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    // No certificate on this work package has been CERTIFIED yet — see
    // this function's own doc comment above.
  }

  return {
    workPackage,
    valuations,
    retention,
    variationOrders,
    kpis: {
      count: valuations.length,
      latestPercentComplete: latest ? latest.percentComplete : 0,
      latestValuationAmount: latest ? latest.valuationAmount : 0,
    },
  };
}

export default async function WorkPackageDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof loadWorkPackageDetail>> = null;
  let error: string | null = null;
  try {
    data = await loadWorkPackageDetail(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load work package.';
  }

  if (error || !data) {
    return (
      <PageContainer>
        {/* FE-1.1 — breadcrumbs added to both this page's headers (see
            PageHeader's own doc comment in Badge.tsx); the pre-existing
            "← Back to register" link below is left untouched. */}
        <PageHeader
          title="Work package detail"
          breadcrumbs={[{ label: 'Work Packages', href: '/work-packages' }, { label: 'Work package detail' }]}
        />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Work package not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/work-packages" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to register
          </Link>
        </p>
      </PageContainer>
    );
  }

  const { workPackage, valuations, retention, variationOrders, kpis } = data;

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/work-packages" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to register
        </Link>
      </p>

      <PageHeader
        title={`${workPackage.code} — ${workPackage.name}`}
        subtitle={`Contractor: ${workPackage.contractor.vendor.name}`}
        breadcrumbs={[{ label: 'Work Packages', href: '/work-packages' }, { label: workPackage.code }]}
      />

      <section style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(6) }}>
        <Badge tone={STATUS_TONE[workPackage.status] ?? 'neutral'}>{workPackage.status}</Badge>
        {workPackage.description && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>{workPackage.description}</span>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Work package budget" value={formatCurrency(Number(workPackage.budgetAmount))} />
        <KpiCard label="Progress valuations" value={String(kpis.count)} />
        <KpiCard label="Latest % complete" value={`${kpis.latestPercentComplete}%`} />
        <KpiCard label="Latest valuation amount" value={formatCurrency(Number(kpis.latestValuationAmount))} />
      </section>

      <section>
        <PageHeader title="Progress valuations" />
        <CreateProgressValuationForm workPackageId={workPackage.id} />
        <ProgressValuationsTable
          workPackageId={workPackage.id}
          rows={valuations}
        />
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Retention" />
        {retention ? (
          <>
            <div style={{ display: 'flex', gap: tokens.space(6), marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
              <span style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
                Retention: {retention.retentionPercent}% · Held: {formatCurrency(Number(retention.totalHeld))} · Released:{' '}
                {formatCurrency(Number(retention.totalReleased))} · Available:{' '}
                {formatCurrency(Number(retention.totalHeld) - Number(retention.totalReleased))}
              </span>
            </div>
            {Number(retention.totalHeld) - Number(retention.totalReleased) > 0 && (
              <ReleaseRetentionForm retentionId={retention.id} workPackageId={workPackage.id} />
            )}
            <RetentionReleasesTable rows={retention.releases} />
          </>
        ) : (
          <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
            No retention record yet — this is created automatically once a certificate on this work package is certified.
          </p>
        )}
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Variation orders" />
        <CreateVariationOrderForm workPackageId={workPackage.id} />
        <VariationOrdersTable
          workPackageId={workPackage.id}
          rows={variationOrders}
        />
      </section>
    </PageContainer>
  );
}
