import Link from 'next/link';
import { PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateParcelForm } from './CreateParcelForm';
import { CreateEstateForm } from './CreateEstateForm';
import { RecordAcquisitionForm } from './RecordAcquisitionForm';
import { LandParcelsTable, EstatesTable } from './LandBankTables';

export const dynamic = 'force-dynamic';

interface LandParcel {
  id: string;
  code: string;
  name: string;
  location: string | null;
  areaSqm: string | number;
  status: string;
  acquisitions: unknown[];
  titleDeeds: unknown[];
  surveyPlans: unknown[];
  plots: unknown[];
}

interface Estate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  projects: unknown[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
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

// FC-1.3 — same nine values as STATUS_TONE above, derived once from it
// (Object.keys) rather than duplicated as a second hand-written list
// that could drift out of sync with it.
const STATUS_FILTER_OPTIONS = Object.keys(STATUS_TONE).map((value) => ({ value, label: value }));

/**
 * Frontend Completion, FE-4.1 — Land Bank, first checkpoint of Stage
 * FE-4 (Real Estate). See `actions.ts`'s own doc comment for why this
 * page scopes to Land Parcels + Land Acquisitions out of
 * `LandBankController`'s much larger surface.
 *
 * `findParcels` includes `acquisitions`/`titleDeeds`/`surveyPlans`/
 * `plots` as nested arrays (confirmed directly) — this page's table
 * shows their COUNTS as a quick sub-resource summary per parcel, the
 * same way `general-ledger/page.tsx`'s Trial Balance KPIs summarize
 * rather than fully render nested data; the full drill-down into any
 * one of those four is left for a later Land Bank checkpoint.
 *
 * `parcelData` bundles `entityId` alongside its `parcels`, the same
 * narrowing shape `general-ledger`/`procurement`/`inventory` all
 * already use so `CreateParcelForm`'s required `entityId: string` prop
 * type-checks under `tsc`.
 *
 * ADDENDUM (FE-4.2) — added a "View" column linking each row to the
 * new `/land-bank/[parcelId]` detail page (Title deeds for that
 * parcel, per that page's own doc comment). No new fetch here — just
 * the `Link`.
 *
 * ADDENDUM (FE-4.6) — Estates: a second, independent entity-scoped
 * register on this same page, fetched via `GET /real-estate/estates?entityId=`
 * (`RealEstateController`, confirmed directly — a different module
 * from `LandBankController`, reused here rather than duplicated; see
 * `actions.ts`'s own doc comment for why). No "View" link added yet —
 * following FE-4.1/FE-4.2's own precedent of not linking to a detail
 * page before it exists (Master Plans, this register's natural detail
 * view, is deliberately deferred to a following checkpoint, the same
 * "confirm the prerequisite exists, then stop" scope FE-4.5's own
 * report asked for).
 *
 * ADDENDUM (FE-4.7) — added the "View" column back to the Estates
 * table, now that `/land-bank/estates/[estateId]` (Master Plans) exists
 * — same precedent this file's own FE-4.2 addendum already set for
 * Land Parcels' own "View" column. No new fetch here either.
 *
 * ADDENDUM (FC-1.3, Frontend Parity) — the Land Parcels table now
 * opts into `DataTable`'s new `filters` prop, as this checkpoint's one
 * real, working demonstration (mirroring how FC-1.2's own `search`
 * addition picked Chart of Accounts as its one demonstration rather
 * than retrofitting every table) — a Status dropdown, `STATUS_FILTER_OPTIONS`
 * derived once from `STATUS_TONE`'s own keys (nine real values) rather
 * than a second, hand-written list that could silently drift out of
 * sync with it. Land Parcels was picked over the Estates table on this
 * same page: parcels are the table most likely to actually grow long
 * (an entity can accumulate many parcels across every stage of
 * acquisition/titling/development), and status is the field a person
 * scanning this list is most likely to want to narrow by. `search` was
 * deliberately NOT also added here — Land Parcels' own code/name pair
 * is short and this table is typically browsed by status, not searched
 * by name, unlike Chart of Accounts' own long, code-heavy reference
 * list.
 */
async function loadEstates(entityId: string) {
  return fetchApi<Estate[]>(`/real-estate/estates?entityId=${entityId}`);
}

export default async function LandBankPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let parcelData: { entityId: string; parcels: LandParcel[] } | null = null;
  let parcelsError: string | null = null;
  let estates: Estate[] | null = null;
  let estatesError: string | null = null;

  if (entityId) {
    try {
      const parcels = await fetchApi<LandParcel[]>(`/land-bank/parcels?entityId=${entityId}`);
      parcelData = { entityId, parcels };
    } catch (e) {
      parcelsError = e instanceof ApiError ? e.message : 'Failed to load land parcels.';
    }

    try {
      estates = await loadEstates(entityId);
    } catch (e) {
      estatesError = e instanceof ApiError ? e.message : 'Failed to load estates.';
    }
  }

  const parcelOptions: SelectOption[] = (parcelData?.parcels ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

  return (
    <PageContainer>
      <PageHeader
        title="Land Bank"
        subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to manage land parcels.'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Land Bank' }]}
      />
      <EntitySelector initialValue={entityId} />

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Land parcels" />

        {parcelsError && (
          <div
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
              marginBottom: tokens.space(4),
            }}
          >
            {parcelsError}
          </div>
        )}

        {parcelData && (
          <>
            <CreateParcelForm entityId={parcelData.entityId} />

            <LandParcelsTable rows={parcelData.parcels} />
          </>
        )}
      </section>

      {parcelData && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader
            title="Record acquisition"
            subtitle="Selects from the parcels listed above."
          />
          <RecordAcquisitionForm parcelOptions={parcelOptions} />
        </section>
      )}

      {entityId && (
        <section>
          <PageHeader title="Estates" />

          {estatesError && (
            <div
              style={{
                color: tokens.color.negative,
                fontFamily: tokens.font.body,
                marginBottom: tokens.space(4),
              }}
            >
              {estatesError}
            </div>
          )}

          {estates && (
            <>
              <CreateEstateForm entityId={entityId} />
              <EstatesTable rows={estates} />
            </>
          )}
        </section>
      )}
    </PageContainer>
  );
}
