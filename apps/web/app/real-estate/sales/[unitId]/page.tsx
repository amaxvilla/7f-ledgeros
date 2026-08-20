import Link from 'next/link';
import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../../lib/api';
import { CancelCurrentForm } from './CancelCurrentForm';
import { ConvertReservationForm } from './ConvertReservationForm';
import { TransferAllocationForm } from './TransferAllocationForm';
import { SwapUnitForm } from './SwapUnitForm';
import { CreateInstallmentScheduleForm } from './CreateInstallmentScheduleForm';
import { UnitInstallmentsTable, AllocationHistoryTable } from '../../RealEstateTables';

export const dynamic = 'force-dynamic';

interface Unit {
  id: string;
  code: string;
  name: string | null;
  unitType: string | null;
  sizeSqm: number | null;
  listPrice: number;
  status: string;
}

interface Floor {
  id: string;
  code: string;
  name: string;
  units: Unit[];
}

interface Block {
  id: string;
  code: string;
  name: string;
  floors: Floor[];
}

interface Phase {
  id: string;
  code: string;
  name: string;
  blocks: Block[];
}

interface ProjectTree {
  id: string;
  code: string;
  name: string;
  phases: Phase[];
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface NamedRef {
  id: string;
  name: string;
}

interface AllocationEvent {
  id: string;
  eventType: string;
  reservationId: string | null;
  allocationId: string | null;
  fromCustomer: NamedRef | null;
  toCustomer: NamedRef | null;
  createdBy: { id: string; firstName: string; lastName: string };
  notes: string | null;
  createdAt: string;
}

interface InstallmentLine {
  id: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidAt: string | null;
}

interface InstallmentSchedule {
  id: string;
  totalAmount: number;
  createdAt: string;
  lines: InstallmentLine[];
}

const UNIT_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  UNDER_CONTRACT: 'warning',
  HANDED_OVER: 'neutral',
  SOLD: 'positive',
};

const EVENT_TYPE_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  RESERVED: 'warning',
  RESERVATION_EXPIRED: 'negative',
  RESERVATION_CANCELLED: 'negative',
  CONVERTED_TO_SALE: 'positive',
  SALE_CANCELLED: 'negative',
  TRANSFERRED: 'neutral',
  SWAPPED: 'neutral',
  RESOLD: 'positive',
};

/**
 * Finds this unit's currently-active reservation id from its own event
 * log, rather than a dedicated "current reservation" field (none
 * exists — `UnitReservation` has no such marker on `Unit` itself,
 * confirmed directly against `schema.prisma`). Events are already
 * ordered `desc` by `createdAt` server-side (`getAllocationHistory`,
 * confirmed directly) — the newest `RESERVED` event's own
 * `reservationId` IS the currently-active one, safely, because this is
 * only ever called when `unit.status === 'RESERVED'` (see `page.tsx`'s
 * own render gate): a unit only enters that status via a fresh
 * `RESERVED` event, and any later cancel/expire/convert for that same
 * reservation would have already flipped `unit.status` away from
 * `RESERVED` — so the status gate itself rules out finding a stale id.
 */
function findCurrentReservationId(events: AllocationEvent[]): string | null {
  return events.find((e) => e.eventType === 'RESERVED')?.reservationId ?? null;
}

/**
 * Same reasoning as `findCurrentReservationId` above, for allocations:
 * the newest event carrying a non-null `allocationId` at all (not
 * necessarily one particular `eventType`, since `CONVERTED_TO_SALE`/
 * `RESOLD` both log the new allocation's id directly) is the currently-
 * active allocation — safe here for the same reason: only rendered when
 * `unit.status` is `ALLOCATED`/`UNDER_CONTRACT`, both of which only
 * arise from a conversion this checkpoint's own `actions.ts` can trace.
 */
function findCurrentAllocationId(events: AllocationEvent[]): string | null {
  return events.find((e) => e.allocationId)?.allocationId ?? null;
}

/**
 * Frontend Completion — Unit detail (`/real-estate/sales/[unitId]`),
 * FE-4.8's own recommended next checkpoint. `GET /real-estate/units/
 * :unitId/allocation-history` (`RealEstateService.getAllocationHistory`,
 * read directly first per that report's own instruction) turns out to
 * return a `UnitAllocationEvent[]` — an EVENT LOG, not a "current
 * reservation/allocation" record — confirmed directly against
 * `schema.prisma`. See `findCurrentReservationId`/
 * `findCurrentAllocationId` above for how this page safely derives a
 * live id to act on from that log rather than a dedicated field, which
 * doesn't exist.
 *
 * STILL NO SINGLE-UNIT ENDPOINT (confirmed unchanged from FE-4.8) — so,
 * same "no single-item endpoint, fetch list + find by id" shape
 * `/land-bank/estates/[estateId]/page.tsx` already established, this
 * page re-fetches the project tree (`GET /dimensions/projects/:id/tree`)
 * and finds the matching unit, rather than a lighter single-unit call
 * that doesn't exist. This means `entityId`/`projectId` MUST travel
 * with the link to this page — there is no way to resolve a bare
 * `unitId` back to its own project otherwise. `sales/page.tsx`'s own
 * Units table now links each row here with both as query params (see
 * that file's own diff) rather than this page attempting to derive
 * them some other way.
 *
 * ONLY CANCEL THIS CHECKPOINT (Reservation or Allocation, whichever
 * currently applies to this unit) — see `actions.ts`'s and
 * `CancelCurrentForm.tsx`'s own doc comments for why Convert/Transfer/
 * Swap all remain deferred: each needs meaningfully more input (GL
 * account pickers for Convert, a second unit/customer picker for
 * Swap/Transfer) than fits this checkpoint's own "smallest logical
 * checkpoint" budget alongside a brand-new detail page.
 *
 * `cancelReservation` requires `realestate.sell`; `cancelAllocation`
 * requires `realestate.manage` — a real, confirmed permission
 * difference (read directly from `RealEstateController`), not assumed
 * symmetric with each other despite both being simple `{ reason }`
 * cancellations. Enforced server-side only, same posture every other
 * permission-gated action in this app already takes.
 *
 * ADDENDUM — `ConvertReservationForm` now covers the other deferred
 * action FE-4.9's own report named: `revenueAccountId`/
 * `arControlAccountId` are real `Select`s fed by `accountOptions` (`GET
 * /accounts/entity/:entityId/active`, fetched here alongside the tree
 * and event log — no separate page just for this) — the same account
 * list `/ap-ar`'s own forms already reuse across differently-named
 * account fields (confirmed directly against `PostARInvoiceButton.tsx`'s
 * own doc comment before building this). Rendered alongside Cancel
 * Reservation, both gated on the same `status === 'RESERVED'` condition
 * and the same derived `reservationId` — `Transfer`/`Swap` Allocation
 * remain the only deferred actions on this controller now.
 *
 * ADDENDUM (FE-4.11) — `Transfer`/`Swap` Allocation, named above as the
 * only remaining deferred pair, are surfaced now: see
 * `TransferAllocationForm.tsx`/`SwapUnitForm.tsx`, both rendered
 * alongside Cancel Allocation, gated on the same `status ===
 * 'ALLOCATED' || 'UNDER_CONTRACT'` condition and the same derived
 * `allocationId` (both keyed by allocation, not reservation — a real
 * difference from `convertReservation` above, confirmed directly
 * against `RealEstateController`'s own routes). `loadUnitDetail` below
 * now also fetches `GET /dimensions/customers` (folded into the same
 * `Promise.all`, no separate loading state) for Transfer's own
 * `customerOptions`, and derives `unitOptions` (every OTHER `AVAILABLE`
 * unit in this SAME project tree, excluding the current unit) in the
 * same tree-walk that already locates the current unit — no new
 * endpoint for either. `RealEstateController` is now fully covered:
 * every mutating action it exposes has a UI.
 *
 * ADDENDUM (FE-4.12) — Installment Schedules: `GET /real-estate/
 * allocations/:allocationId/schedule` (read-only) and `POST
 * /real-estate/installment-schedules` (create) now both have a UI,
 * rendered in the same `ALLOCATED`/`UNDER_CONTRACT` section as
 * Transfer/Swap/Cancel Allocation, using the same derived
 * `allocationId`. Read `fetchScheduleOrNull`'s own doc comment
 * (immediately below) for why this page needed its first-ever
 * 404-tolerant fetch to support this: an allocation with no schedule
 * yet is a normal state, not an error, and `reservationId`/
 * `allocationId` themselves are now computed once inside
 * `loadUnitDetail` (previously recomputed per-render via an inline
 * IIFE in the JSX below) specifically so the schedule fetch — which
 * needs `allocationId` before it can even run — has it available
 * without a second, separate derivation.
 */
/**
 * `GET /real-estate/allocations/:allocationId/schedule` 404s
 * (`NotFoundException`) when no schedule has been created yet for this
 * allocation — a normal, expected state (most allocations won't have
 * one), not a page-load error. No existing page in this app has
 * needed to tell "genuinely not found yet" apart from "the request
 * actually failed" before now (checked directly: no `.status === 404`
 * check exists anywhere else in `apps/web`) — this is the first. Only
 * this one specific 404 is swallowed; any other error (network
 * failure, a different 4xx/5xx) still propagates to `loadUnitDetail`'s
 * own caller exactly the way every other fetch in this file already
 * does, so a real failure still surfaces as this page's own top-level
 * error banner rather than being silently treated as "no schedule".
 */
async function fetchScheduleOrNull(allocationId: string): Promise<InstallmentSchedule | null> {
  try {
    return await fetchApi<InstallmentSchedule>(`/real-estate/allocations/${allocationId}/schedule`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

async function loadUnitDetail(unitId: string, entityId: string, projectId: string) {
  const [tree, events, accounts, customers] = await Promise.all([
    fetchApi<ProjectTree>(`/dimensions/projects/${projectId}/tree`),
    fetchApi<AllocationEvent[]>(`/real-estate/units/${unitId}/allocation-history`),
    fetchApi<Account[]>(`/accounts/entity/${entityId}/active`),
    fetchApi<Customer[]>('/dimensions/customers'),
  ]);
  const accountOptions: SelectOption[] = accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  const customerOptions: SelectOption[] = customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  const unitOptions: SelectOption[] = [];
  let matchedUnit: Unit | null = null;
  let matchedPhaseLabel = '';
  let matchedBlockLabel = '';
  let matchedFloorLabel = '';

  for (const phase of tree.phases) {
    for (const block of phase.blocks) {
      for (const floor of block.floors) {
        for (const unit of floor.units) {
          if (unit.id === unitId) {
            matchedUnit = unit;
            matchedPhaseLabel = `${phase.code} ${phase.name}`;
            matchedBlockLabel = `${block.code} ${block.name}`;
            matchedFloorLabel = `${floor.code} ${floor.name}`;
          } else if (unit.status === 'AVAILABLE') {
            unitOptions.push({ value: unit.id, label: unit.name ? `${unit.code} — ${unit.name}` : unit.code });
          }
        }
      }
    }
  }

  if (!matchedUnit) return null;

  const reservationId = matchedUnit.status === 'RESERVED' ? findCurrentReservationId(events) : null;
  const allocationId =
    matchedUnit.status === 'ALLOCATED' || matchedUnit.status === 'UNDER_CONTRACT' ? findCurrentAllocationId(events) : null;
  const schedule = allocationId ? await fetchScheduleOrNull(allocationId) : null;

  return {
    unit: matchedUnit,
    phaseLabel: matchedPhaseLabel,
    blockLabel: matchedBlockLabel,
    floorLabel: matchedFloorLabel,
    events,
    accountOptions,
    customerOptions,
    unitOptions,
    reservationId,
    allocationId,
    schedule,
  };
}

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: { unitId: string };
  searchParams: { entityId?: string; projectId?: string };
}) {
  const { unitId } = params;
  const { entityId, projectId } = searchParams;

  if (!entityId || !projectId) {
    return (
      <PageContainer>
        <PageHeader
          title="Unit detail"
          subtitle="Missing entityId/projectId — open this page from a unit row on the Property Sales page instead of navigating here directly."
        />
        <Link href="/real-estate/sales" style={{ color: tokens.color.accent, fontFamily: tokens.font.body }}>
          ← Back to Property Sales
        </Link>
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadUnitDetail>> | null = null;
  let error: string | null = null;
  try {
    data = await loadUnitDetail(unitId, entityId, projectId);
    if (!data) error = 'This unit was not found in the selected project.';
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load unit detail.';
  }

  const backHref = `/real-estate/sales?entityId=${entityId}&projectId=${projectId}`;

  return (
    <PageContainer>
      <PageHeader title={data ? `Unit ${data.unit.code}` : 'Unit detail'} subtitle={data ? data.unit.name ?? undefined : undefined} />
      <Link href={backHref} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, marginBottom: tokens.space(6), display: 'inline-block' }}>
        ← Back to Property Sales
      </Link>

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(6),
              padding: tokens.space(4),
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              fontFamily: tokens.font.body,
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textMuted }}>Location</div>
              <div>{`${data.phaseLabel} / ${data.blockLabel} / ${data.floorLabel}`}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textMuted }}>Type</div>
              <div>{data.unit.unitType ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textMuted }}>Size (sqm)</div>
              <div>{data.unit.sizeSqm === null ? '—' : String(data.unit.sizeSqm)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textMuted }}>List price</div>
              <div>{formatCurrency(data.unit.listPrice)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.color.textMuted }}>Status</div>
              <Badge tone={UNIT_STATUS_TONE[data.unit.status] ?? 'neutral'}>{data.unit.status}</Badge>
            </div>
          </section>

          {data.unit.status === 'RESERVED' && data.reservationId && (
            <>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader title="Convert to sale" />
                <ConvertReservationForm unitId={unitId} reservationId={data.reservationId} accountOptions={data.accountOptions} />
              </section>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader title="Cancel reservation" />
                <CancelCurrentForm unitId={unitId} kind="reservation" targetId={data.reservationId} />
              </section>
            </>
          )}

          {(data.unit.status === 'ALLOCATED' || data.unit.status === 'UNDER_CONTRACT') && data.allocationId && (
            <>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader title="Transfer allocation" subtitle="Move this allocation to a different customer." />
                <TransferAllocationForm unitId={unitId} allocationId={data.allocationId} customerOptions={data.customerOptions} />
              </section>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader title="Swap unit" subtitle="Move this customer to a different available unit in this project." />
                <SwapUnitForm unitId={unitId} allocationId={data.allocationId} unitOptions={data.unitOptions} />
              </section>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader
                  title="Installment schedule"
                  subtitle={data.schedule ? `${data.schedule.lines.length} installment${data.schedule.lines.length === 1 ? '' : 's'}` : undefined}
                />
                {data.schedule ? (
                  <UnitInstallmentsTable rows={data.schedule.lines} />
                ) : (
                  <CreateInstallmentScheduleForm unitId={unitId} allocationId={data.allocationId} />
                )}
              </section>
              <section style={{ marginBottom: tokens.space(8) }}>
                <PageHeader title="Cancel allocation" />
                <CancelCurrentForm unitId={unitId} kind="allocation" targetId={data.allocationId} />
              </section>
            </>
          )}

          <section>
            <PageHeader title="Allocation history" subtitle={`${data.events.length} event${data.events.length === 1 ? '' : 's'}`} />
            <AllocationHistoryTable rows={data.events} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
