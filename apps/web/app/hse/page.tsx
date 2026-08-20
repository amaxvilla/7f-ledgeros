import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateIncidentReportForm } from './CreateIncidentReportForm';
import { IncidentStatusActions } from './IncidentStatusActions';
import { CreateCorrectiveActionForm } from './CreateCorrectiveActionForm';
import { CorrectiveActionActions } from './CorrectiveActionActions';
import { CreateToolboxTalkForm } from './CreateToolboxTalkForm';
import { CreatePpeIssuanceForm } from './CreatePpeIssuanceForm';
import { CreateInspectionChecklistForm } from './CreateInspectionChecklistForm';
import { RecordItemResultForm } from './RecordItemResultForm';
import { FinalizeChecklistButton } from './FinalizeChecklistButton';
import { NearMissStatusActions } from './NearMissStatusActions';
import { HseIncidentsTable, HseNearMissesTable, HseCorrectiveActionsTable, HseExpiringPpeTable, HseToolboxTalksTable, HseInspectionChecklistsTable } from './HseTables';

export const dynamic = 'force-dynamic';

type HseCaseStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED';
type CorrectiveActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
type IncidentSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'FATAL';
type InspectionResult = 'PASS' | 'PASS_WITH_OBSERVATIONS' | 'FAIL' | null;

interface Project {
  id: string;
  code: string;
  name: string;
}

interface CorrectiveActionRow {
  id: string;
  description: string;
  dueDate: string;
  status: CorrectiveActionStatus;
}

interface IncidentReport {
  id: string;
  incidentDate: string;
  location: string | null;
  description: string;
  severity: IncidentSeverity;
  status: HseCaseStatus;
  correctiveActions: CorrectiveActionRow[];
}

interface NearMiss {
  id: string;
  occurredAt: string;
  location: string | null;
  description: string;
  status: HseCaseStatus;
  correctiveActions: CorrectiveActionRow[];
}

interface ToolboxTalk {
  id: string;
  topic: string;
  talkDate: string;
  attendeeCount: number;
}

interface InspectionChecklistItem {
  id: string;
  itemDescription: string;
  isCompliant: boolean | null;
  remarks: string | null;
}

interface InspectionChecklist {
  id: string;
  checklistType: string;
  inspectionDate: string;
  result: InspectionResult;
  items: InspectionChecklistItem[];
}

interface ExpiringPpeIssuance {
  id: string;
  itemName: string;
  quantity: number;
  expiryDate: string | null;
  employee: { firstName: string; lastName: string };
}

const CASE_STATUS_TONE: Record<HseCaseStatus, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'negative',
  INVESTIGATING: 'warning',
  CLOSED: 'positive',
};

const ACTION_STATUS_TONE: Record<CorrectiveActionStatus, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  OVERDUE: 'negative',
};

const SEVERITY_TONE: Record<IncidentSeverity, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  MINOR: 'neutral',
  MODERATE: 'warning',
  SEVERE: 'negative',
  FATAL: 'negative',
};

/** 30 days from today, `YYYY-MM-DD` — the `onOrBefore` cutoff for "expiring soon" PPE. Server-rendered, so "today" means the moment this page's own request is handled, not the client's clock. */
function thirtyDaysFromNowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Frontend Completion — HSE Dashboard (`/hse`), the first page for this
 * module. Picked up directly from FE-2.3's own recommendation, itself a
 * correction of an earlier wrong assumption in that same checkpoint's
 * history ("no confirmed backend surface" — WRONG, corrected in the
 * same session once `HseController`/`HseService` were actually read).
 *
 * BEFORE PICKING THIS OVER FE-2.4's OTHER NAMED CANDIDATE (Finance or
 * Treasury Dashboard): read `DashboardController` directly for every
 * `dashboard/*` route rather than trusting either name. Neither Finance
 * nor Treasury has a single composite endpoint the way Executive/HR/
 * CRM/Real Estate do — but more importantly, the root dashboard
 * (`app/page.tsx`) already combines every widget either of those two
 * roadmap items would need: `budget-vs-actual`, `outstanding-payables-
 * receivables`, `cash-forecast`, `loan-exposure`, `bank-reconciliation-
 * status`, `top-projects-by-variance` — confirmed directly by reading
 * that file in full. A dedicated `/finance` or `/treasury-dashboard`
 * page would be substantially redundant with what `/` already shows,
 * the same "already satisfies the roadmap item, small enhancement
 * opportunity rather than a real gap" position FE-2.3's own report
 * already took on CRM. HSE genuinely has nothing yet — no dashboard,
 * no register, no create forms, nothing at all under `apps/web/app/hse`
 * before this checkpoint (confirmed with a `find` before starting) — a
 * real, unambiguous gap, unlike Finance/Treasury.
 *
 * NO SINGLE COMPOSITE ENDPOINT EXISTS FOR HSE, CONFIRMED DIRECTLY
 * against `HseController`: six list endpoints (`incidents`, `near-
 * misses`, `ppe-issuances`(`/expiring`), `toolbox-talks`, `corrective-
 * actions`, `inspection-checklists`), no `hse/*-overview` route the way
 * every other FE-2 dashboard has had. This page aggregates client-side,
 * the same shape this checkpoint's own predecessor named as the
 * likely-needed approach.
 *
 * ONLY FIVE OF THE SIX LIST ENDPOINTS ARE CALLED — `corrective-actions`
 * DELIBERATELY IS NOT, AND THIS IS A REAL SCOPING FINDING, NOT AN
 * OVERSIGHT: read `HseService.findCorrectiveActions` directly and
 * confirmed it takes only `assignedToId`/`status` filters — no
 * `entityId` at all, because `CorrectiveAction` has no `entityId`
 * column of its own in the schema (only `incidentReportId`/
 * `nearMissId`, confirmed directly against the Prisma model). Calling
 * `GET /hse/corrective-actions` directly from an entity-scoped
 * dashboard would return corrective actions across EVERY entity, a
 * real cross-tenant leak this page must not introduce. Instead: both
 * `findIncidentReports` and `findNearMisses` already `include: {
 * correctiveActions: true }` (confirmed directly) — so every corrective
 * action relevant to THIS entity is already nested inside the two
 * entity-scoped fetches this page needs anyway. The Corrective actions
 * table below is built by flattening `incidents[].correctiveActions`
 * and `nearMisses[].correctiveActions` together, not a seventh fetch.
 *
 * `ppe-issuances/expiring` takes BOTH `entityId` and `onOrBefore` as
 * required query params (confirmed directly, no `?` on either in the
 * controller signature) — `onOrBefore` is computed server-side as
 * "30 days from now" (`thirtyDaysFromNowIso`), not a user-facing
 * picker; no other page in this app has ever exposed a rolling-window
 * picker like that, and 30 days is a reasonable, common PPE-replacement
 * lead time to default to without one.
 *
 * No forms, no new Server Actions — same "read-only dashboard" scope
 * every FE-2 page has had. A follow-up checkpoint would be needed for
 * HSE's own create forms (`Post incidents`, `Post near-misses`, etc.) —
 * genuinely a different, larger checkpoint (register + create-form
 * pages, FE-3-module-shaped work), not attempted here.
 *
 * ADDENDUM — Incident Reports create form + status actions. The
 * "follow-up checkpoint" named just above, scoped to Incident Reports
 * alone rather than all six HSE sub-resources at once — see
 * `actions.ts`'s own doc comment for the full before-coding analysis.
 * `projectOptions` (`GET /dimensions/projects?entityId=`) is fetched
 * here, folded into the existing `Promise.all`, and passed down to
 * `CreateIncidentReportForm`; the Incidents table gets a new Actions
 * column rendering `IncidentStatusActions` per row. Near misses, PPE,
 * toolbox talks, corrective actions, and inspection checklists remain
 * read-only dashboard sections only — each its own future checkpoint,
 * not attempted here.
 *
 * ADDENDUM (HSE.2) — Corrective Actions create form + Complete action.
 * `linkOptions` (for `CreateCorrectiveActionForm`'s own combined
 * "Linked to" `Select`) is built from the SAME `incidents`/`nearMisses`
 * arrays this page already fetches — no new call — with each option's
 * `value` prefixed `incident:`/`nearmiss:` so the form can split it
 * back into the correct DTO field at submit time; see `actions.ts`'s
 * own doc comment for why this is one combined picker, not two. The
 * Corrective actions table gets a new Actions column rendering
 * `CorrectiveActionActions` per row. PPE, toolbox talks, and inspection
 * checklists remain read-only — each its own future checkpoint.
 *
 * ADDENDUM (HSE.3) — Toolbox Talks create form. No new fetch —
 * `CreateToolboxTalkForm` reuses the same `projectOptions` prop
 * `CreateIncidentReportForm` already established. No Actions column —
 * toolbox talks have no per-row status/complete route the way
 * Corrective Actions and Incidents both do (confirmed directly against
 * `HseController`); see `actions.ts`'s own doc comment for the full
 * before-coding analysis, including why Toolbox Talks was picked over
 * PPE Issuances and Inspection Checklists as the next "one resource per
 * checkpoint" pick. PPE issuances and inspection checklists remain
 * read-only — each its own future checkpoint.
 *
 * ADDENDUM (HSE.4) — PPE Issuances create form. No new fetch —
 * `CreatePpeIssuanceForm` only needs `entityId`, already a page-level
 * value, not a prop derived from `loadHseDashboard`. Rendered above the
 * existing "PPE expiring within 30 days" table (still the only PPE
 * read-only view this page has — `findPpeIssuances`'s own full list is
 * not fetched here, same "smallest logical checkpoint" scoping as
 * HSE.3). No Actions column — see `actions.ts`'s own doc comment for
 * why. Inspection checklists remain read-only — its own future
 * checkpoint, confirmed to need a genuinely different, larger
 * repeatable-row form treatment.
 *
 * ADDENDUM (HSE.5) — Inspection Checklists create form. No new
 * fetch — `CreateInspectionChecklistForm` reuses the same
 * `projectOptions` prop the other HSE forms already established. Only
 * the CREATE path is added here; per-item result recording and
 * checklist finalization remain unbuilt, both requiring an already-
 * created checklist's own row-level `id`s and each other's own genuinely
 * larger UI treatment — see `CreateInspectionChecklistForm.tsx`'s own
 * doc comment. The Inspection checklists table itself is unchanged.
 *
 * ADDENDUM (HSE.6) — per-item result recording + Finalize, HSE.5's own
 * recommended next checkpoint, closing out HSE's write-path coverage
 * entirely. The "Items" column now renders `RecordItemResultForm` per
 * item (a nested per-row form inside the cell — see that component's
 * own doc comment for why `DataTable` needed this rather than a
 * page-level form) instead of a bare assessed-count string; a new
 * "Finalize" column renders `FinalizeChecklistButton`. Both item `id`s
 * and the checklist's own `result` already come from the same
 * `checklists` fetch this page has had since HSE.1 (`InspectionChecklistItem`'s
 * local type gained `itemDescription`/`remarks`, both already returned
 * by the existing `GET /hse/inspection-checklists` — confirmed
 * directly, no new fetch or backend change needed).
 *
 * ADDENDUM (HSE.7) — Near Miss status actions. The Near Misses table
 * gains an Actions column rendering `NearMissStatusActions`, mirroring
 * Incidents' own `IncidentStatusActions` from HSE.1 — see that
 * component's own doc comment for the one real difference
 * (`advanceNearMissStatus` has no corrective-action-closed guard). No
 * new fetch — `nearMisses` already carries `id`/`status`.
 */
async function loadHseDashboard(entityId: string) {
  const [incidents, nearMisses, toolboxTalks, checklists, expiringPpe, projects] = await Promise.all([
    fetchApi<IncidentReport[]>(`/hse/incidents?entityId=${entityId}`),
    fetchApi<NearMiss[]>(`/hse/near-misses?entityId=${entityId}`),
    fetchApi<ToolboxTalk[]>(`/hse/toolbox-talks?entityId=${entityId}`),
    fetchApi<InspectionChecklist[]>(`/hse/inspection-checklists?entityId=${entityId}`),
    fetchApi<ExpiringPpeIssuance[]>(`/hse/ppe-issuances/expiring?entityId=${entityId}&onOrBefore=${thirtyDaysFromNowIso()}`),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const correctiveActions = [
    ...incidents.flatMap((i) => i.correctiveActions),
    ...nearMisses.flatMap((n) => n.correctiveActions),
  ];

  const projectOptions: SelectOption[] = projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

  const linkOptions: SelectOption[] = [
    ...incidents.map((i) => ({ value: `incident:${i.id}`, label: `Incident — ${new Date(i.incidentDate).toLocaleDateString()} — ${i.description.slice(0, 40)}` })),
    ...nearMisses.map((n) => ({ value: `nearmiss:${n.id}`, label: `Near miss — ${new Date(n.occurredAt).toLocaleDateString()} — ${n.description.slice(0, 40)}` })),
  ];

  return { incidents, nearMisses, toolboxTalks, checklists, expiringPpe, correctiveActions, projectOptions, linkOptions };
}

export default async function HseDashboardPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="HSE" subtitle="Enter an entity ID to view its HSE dashboard." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadHseDashboard>> | null = null;
  let error: string | null = null;
  try {
    data = await loadHseDashboard(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load HSE dashboard data.';
  }

  return (
    <PageContainer>
      <PageHeader title="HSE" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          {(() => {
            const openIncidents = data.incidents.filter((i) => i.status !== 'CLOSED');
            const openNearMisses = data.nearMisses.filter((n) => n.status !== 'CLOSED');
            const overdueActions = data.correctiveActions.filter((a) => a.status === 'OVERDUE');
            const openActions = data.correctiveActions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS');
            const severeOrFatalOpen = openIncidents.filter((i) => i.severity === 'SEVERE' || i.severity === 'FATAL').length;

            return (
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(8),
                }}
              >
                <KpiCard
                  label="Open incidents"
                  value={String(openIncidents.length)}
                  tone={severeOrFatalOpen > 0 ? 'negative' : openIncidents.length > 0 ? 'warning' : 'positive'}
                  caption={severeOrFatalOpen > 0 ? `${severeOrFatalOpen} severe/fatal` : undefined}
                />
                <KpiCard
                  label="Open near misses"
                  value={String(openNearMisses.length)}
                  tone={openNearMisses.length > 0 ? 'warning' : 'positive'}
                />
                <KpiCard
                  label="Corrective actions open"
                  value={String(openActions.length)}
                  caption={`${data.correctiveActions.length} total`}
                  tone={openActions.length > 0 ? 'warning' : 'positive'}
                />
                <KpiCard
                  label="Corrective actions overdue"
                  value={String(overdueActions.length)}
                  tone={overdueActions.length > 0 ? 'negative' : 'positive'}
                />
                <KpiCard
                  label="PPE expiring in 30 days"
                  value={String(data.expiringPpe.length)}
                  tone={data.expiringPpe.length > 0 ? 'warning' : 'positive'}
                />
              </section>
            );
          })()}

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Incidents" />
            <CreateIncidentReportForm entityId={entityId} projectOptions={data.projectOptions} />
            <HseIncidentsTable rows={data.incidents} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Near misses" />
            <HseNearMissesTable rows={data.nearMisses} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Corrective actions" />
            <CreateCorrectiveActionForm linkOptions={data.linkOptions} />
            <HseCorrectiveActionsTable rows={data.correctiveActions} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="PPE expiring within 30 days" />
            <CreatePpeIssuanceForm entityId={entityId} />
            <HseExpiringPpeTable rows={data.expiringPpe} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Toolbox talks" subtitle={`${data.toolboxTalks.length} logged, ${data.toolboxTalks.reduce((sum, t) => sum + t.attendeeCount, 0)} total attendees`} />
            <CreateToolboxTalkForm entityId={entityId} projectOptions={data.projectOptions} />
            <HseToolboxTalksTable rows={data.toolboxTalks} />
          </section>

          <section>
            <PageHeader title="Inspection checklists" />
            <CreateInspectionChecklistForm entityId={entityId} projectOptions={data.projectOptions} />
            <HseInspectionChecklistsTable rows={data.checklists} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
