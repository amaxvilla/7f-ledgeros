import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { AddTitleDeedForm } from './AddTitleDeedForm';
import { TitleDeedActions } from './TitleDeedActions';
import { CreateSurveyPlanForm } from './CreateSurveyPlanForm';
import { SurveyPlanActions } from './SurveyPlanActions';
import { SubdividePlotsForm } from './SubdividePlotsForm';
import { PlotReleaseActions } from './PlotReleaseActions';

export const dynamic = 'force-dynamic';

interface TitleDeed {
  id: string;
  parcelId: string;
  titleType: string;
  titleNumber: string | null;
  status: string;
  issuingAuthority: string | null;
  applicationDate: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentRef: string | null;
  notes: string | null;
}

interface SurveyPlan {
  id: string;
  parcelId: string;
  planNumber: string;
  surveyorName: string | null;
  surveyDate: string | null;
  areaSqm: string | number | null;
  documentRef: string | null;
  status: string;
}

interface PlotRelease {
  projectId: string;
  releaseDate: string;
  notes: string | null;
  cancelledAt: string | null;
}

interface Plot {
  id: string;
  plotNumber: string;
  areaSqm: string | number;
  useType: string;
  status: string;
  notes: string | null;
  release: PlotRelease | null;
}

interface LandParcelDetail {
  id: string;
  entityId: string;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  stateProvince: string | null;
  localGovernmentArea: string | null;
  areaSqm: string | number;
  acquisitionCostBudget: string | number | null;
  status: string;
  titleDeeds: TitleDeed[];
  acquisitions: unknown[];
  surveyPlans: SurveyPlan[];
  plots: Plot[];
}

const PARCEL_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  AVAILABLE: 'neutral',
  UNDER_ACQUISITION: 'warning',
  ACQUIRED: 'positive',
  IN_TITLING: 'warning',
  TITLED: 'positive',
  SURVEYED: 'positive',
  SUBDIVIDED: 'positive',
  DEVELOPED: 'positive',
  DISPOSED: 'negative',
};

const TITLE_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'warning',
  PERFECTED: 'positive',
  REJECTED: 'negative',
  EXPIRED: 'warning',
};

const TITLE_TYPE_LABEL: Record<string, string> = {
  CERTIFICATE_OF_OCCUPANCY: 'Certificate of Occupancy',
  DEED_OF_ASSIGNMENT: 'Deed of Assignment',
  GOVERNORS_CONSENT: "Governor's Consent",
  GAZETTE: 'Gazette',
  FREEHOLD: 'Freehold',
  LEASEHOLD: 'Leasehold',
  OTHER: 'Other',
};

const SURVEY_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
};

const PLOT_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PLANNED: 'neutral',
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  SOLD: 'positive',
};

const PLOT_USE_TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  MIXED_USE: 'Mixed use',
  INDUSTRIAL: 'Industrial',
  AGRICULTURAL: 'Agricultural',
};

/**
 * Frontend Completion, FE-4.2 — Land Parcel detail (`/land-bank/[parcelId]`),
 * FE-4.1's own recommended next checkpoint. See `actions.ts`'s own doc
 * comment for why this checkpoint scopes to Titles alone out of
 * `LandBankController`'s remaining surface (Survey Plans, Plots, Master
 * Plans, Plot Releases all deliberately deferred).
 *
 * `GET /land-bank/parcels/:parcelId` (`getParcel`) already `include`s
 * `acquisitions`/`titleDeeds`/`surveyPlans`/`plots` in one call
 * (confirmed directly) — a real difference from `/work-packages/[id]`'s
 * own detail page elsewhere in this app, which had no single-item
 * endpoint at all and had to fetch-and-filter the list. Here, ONE fetch
 * is genuinely enough; no `Promise.all` needed.
 *
 * `acquisitions`/`surveyPlans`/`plots` are shown as KPI-card COUNTS
 * only, the same "summarize, don't fully render, what this checkpoint
 * didn't scope to" reasoning `/land-bank/page.tsx`'s own doc comment
 * already used for the register's own nested-array columns — full
 * drill-down into any of the three is a later Land Bank checkpoint's
 * job (Survey Plans next, per FE-4.1's own report), not silently
 * expanded here.
 *
 * Addendum, FE-4.3 — Survey Plans: same detail page, no new fetch —
 * `getParcel`'s own `include` already returns `surveyPlans` in full
 * (this page was only using `.length` before this checkpoint, the same
 * "widen the existing type, don't add a call" shape `/work-packages/[id]`
 * elsewhere in this app used for its own Certificate column). Plots and
 * Master Plans remain KPI-count-only, deliberately deferred again —
 * `subdivideParcel` (Plots) depends on a `surveyPlanId`, so it's the
 * natural next checkpoint now that Survey Plans exists to supply one,
 * not before.
 *
 * Addendum, FE-4.4 — Plots: same detail page again, no new fetch —
 * `getParcel`'s own `include` already returns `plots` in full (widened
 * from `.length` to a real `Plot[]` type, same shape as Survey Plans'
 * own widening one checkpoint ago). `surveyPlanOptions` is built here
 * (`parcel.surveyPlans.filter(s => s.status === 'APPROVED')`, mapped to
 * `{value, label}`) and passed down to `SubdividePlotsForm` — this
 * page does the filtering, the same "page filters, component only
 * renders what it's given" split `project-issues/page.tsx`'s own
 * `requisitions` prop established elsewhere in this app. This checkpoint
 * deliberately has NO per-row Plot actions (`updatePlotStatus` and the
 * two plot-release endpoints are both left unsurfaced) — `PlotStatus`'s
 * five values (`PLANNED`/`AVAILABLE`/`RESERVED`/`ALLOCATED`/`SOLD`) read
 * like a natural progression, but `UpdatePlotStatusDto.status` is a
 * plain unvalidated string server-side (confirmed directly — no
 * `@IsEnum`, no transition guard at all), so inventing a linear
 * advance/reject UI here would be presenting a workflow structure the
 * backend itself doesn't actually enforce. Reserving/allocating/selling
 * a plot most plausibly belongs with the release endpoints
 * (`plots/:plotId/release`) once those are built, not as a bare status
 * dropdown — named as a real open question for that future checkpoint,
 * not resolved here.
 *
 * Addendum, FE-4.5 — Plot -> Project Release: `getParcel`'s own `plots`
 * include was widened server-side this checkpoint to also include each
 * plot's `release` relation (`LandBankService.getParcel`, `plots: {
 * include: { release: true } }`) — the same "widen the existing type,
 * don't add a call" shape every prior Land Bank addendum in this file
 * has used, this time requiring the one genuinely-minimal backend
 * change the master prompt's own "only add backend code if required to
 * support a frontend feature" rule allows. `projectOptions` (`GET
 * /dimensions/projects?entityId=`, confirmed directly against
 * `DimensionsService.findProjects`) is fetched alongside the parcel
 * itself for `PlotReleaseActions`' own release form's `Select` — this
 * page's first sequential second fetch, since every prior checkpoint
 * here only ever needed the one parcel fetch (the project fetch needs
 * `parcel.entityId`, so it can't be parallelized with the parcel fetch
 * itself). `updatePlotStatus` remains deliberately unsurfaced even now
 * — see `PlotReleaseActions.tsx`'s own doc comment for why
 * `RESERVED`/`PLANNED`/`SOLD` still get no action.
 */
async function loadParcelDetail(parcelId: string) {
  const parcel = await fetchApi<LandParcelDetail>(`/land-bank/parcels/${parcelId}`);
  const projects = await fetchApi<{ id: string; code: string; name: string }[]>(
    `/dimensions/projects?entityId=${parcel.entityId}`,
  );
  return {
    parcel,
    projectOptions: projects.map<SelectOption>((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
  };
}

export default async function LandParcelDetailPage({ params }: { params: { parcelId: string } }) {
  let parcel: LandParcelDetail | null = null;
  let projectOptions: SelectOption[] = [];
  let error: string | null = null;
  try {
    const result = await loadParcelDetail(params.parcelId);
    parcel = result.parcel;
    projectOptions = result.projectOptions;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load land parcel.';
  }

  if (error || !parcel) {
    return (
      <PageContainer>
        <PageHeader title="Land parcel detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Land parcel not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/land-bank" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Land Bank
          </Link>
        </p>
      </PageContainer>
    );
  }

  const perfectedTitles = parcel.titleDeeds.filter((t) => t.status === 'PERFECTED').length;
  const surveyPlanOptions: SelectOption[] = parcel.surveyPlans
    .filter((s) => s.status === 'APPROVED')
    .map((s) => ({ value: s.id, label: s.planNumber }));

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/land-bank" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Land Bank
        </Link>
      </p>

      <PageHeader
        title={`${parcel.code} — ${parcel.name}`}
        subtitle={[parcel.location, parcel.stateProvince, parcel.localGovernmentArea].filter(Boolean).join(', ') || undefined}
      />

      <section style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(6) }}>
        <Badge tone={PARCEL_STATUS_TONE[parcel.status] ?? 'neutral'}>{parcel.status}</Badge>
        {parcel.description && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>{parcel.description}</span>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Area (sqm)" value={String(parcel.areaSqm)} />
        <KpiCard
          label="Acquisition cost budget"
          value={parcel.acquisitionCostBudget != null ? formatCurrency(Number(parcel.acquisitionCostBudget)) : '—'}
        />
        <KpiCard label="Titles (perfected / total)" value={`${perfectedTitles} / ${parcel.titleDeeds.length}`} />
        <KpiCard label="Acquisitions" value={String(parcel.acquisitions.length)} />
        <KpiCard label="Survey plans" value={String(parcel.surveyPlans.length)} />
        <KpiCard label="Plots" value={String(parcel.plots.length)} />
      </section>

      <section>
        <PageHeader title="Title deeds" />
        <AddTitleDeedForm parcelId={parcel.id} />
        <DataTable
          columns={[
            { header: 'Type', render: (t: TitleDeed) => TITLE_TYPE_LABEL[t.titleType] ?? t.titleType },
            { header: 'Title #', render: (t: TitleDeed) => t.titleNumber ?? '—' },
            { header: 'Issuing authority', render: (t: TitleDeed) => t.issuingAuthority ?? '—' },
            { header: 'Issued', render: (t: TitleDeed) => (t.issuedDate ? new Date(t.issuedDate).toLocaleDateString() : '—') },
            { header: 'Expiry', render: (t: TitleDeed) => (t.expiryDate ? new Date(t.expiryDate).toLocaleDateString() : '—') },
            { header: 'Status', render: (t: TitleDeed) => <Badge tone={TITLE_STATUS_TONE[t.status] ?? 'neutral'}>{t.status}</Badge> },
            { header: 'Notes', render: (t: TitleDeed) => t.notes ?? '—' },
            {
              header: 'Actions',
              align: 'right',
              render: (t: TitleDeed) => <TitleDeedActions id={t.id} status={t.status} parcelId={parcel.id} />,
            },
          ]}
          rows={parcel.titleDeeds}
          keyOf={(t) => t.id}
          emptyMessage="No title deeds recorded for this parcel yet."
        />
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Survey plans" />
        <CreateSurveyPlanForm parcelId={parcel.id} />
        <DataTable
          columns={[
            { header: 'Plan #', render: (s: SurveyPlan) => s.planNumber },
            { header: 'Surveyor', render: (s: SurveyPlan) => s.surveyorName ?? '—' },
            { header: 'Survey date', render: (s: SurveyPlan) => (s.surveyDate ? new Date(s.surveyDate).toLocaleDateString() : '—') },
            { header: 'Area (sqm)', align: 'right', render: (s: SurveyPlan) => (s.areaSqm != null ? String(s.areaSqm) : '—') },
            { header: 'Status', render: (s: SurveyPlan) => <Badge tone={SURVEY_STATUS_TONE[s.status] ?? 'neutral'}>{s.status}</Badge> },
            {
              header: 'Actions',
              align: 'right',
              render: (s: SurveyPlan) => <SurveyPlanActions id={s.id} status={s.status} parcelId={parcel.id} />,
            },
          ]}
          rows={parcel.surveyPlans}
          keyOf={(s) => s.id}
          emptyMessage="No survey plans recorded for this parcel yet."
        />
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Plots" />
        <SubdividePlotsForm parcelId={parcel.id} surveyPlanOptions={surveyPlanOptions} />
        <DataTable
          columns={[
            { header: 'Plot #', render: (p: Plot) => p.plotNumber },
            { header: 'Area (sqm)', align: 'right', render: (p: Plot) => String(p.areaSqm) },
            { header: 'Use type', render: (p: Plot) => PLOT_USE_TYPE_LABEL[p.useType] ?? p.useType },
            { header: 'Status', render: (p: Plot) => <Badge tone={PLOT_STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge> },
            { header: 'Notes', render: (p: Plot) => p.notes ?? '—' },
            {
              header: 'Actions',
              align: 'right',
              render: (p: Plot) => (
                <PlotReleaseActions
                  plotId={p.id}
                  status={p.status}
                  parcelId={parcel.id}
                  projectOptions={projectOptions}
                  release={p.release && !p.release.cancelledAt ? p.release : null}
                />
              ),
            },
          ]}
          rows={parcel.plots}
          keyOf={(p) => p.id}
          emptyMessage="This parcel has not been subdivided into plots yet."
        />
      </section>
    </PageContainer>
  );
}
