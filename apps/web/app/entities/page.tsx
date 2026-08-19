import Link from 'next/link';
import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateEntityForm } from './CreateEntityForm';
import { EntityTable } from './EntityTable';

export const dynamic = 'force-dynamic';

interface EntityRow {
  id: string;
  code: string;
  name: string;
  legalName: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  isActive: boolean;
  isConsolidationParent: boolean;
  parentEntityId: string | null;
  subsidiaries: { id: string }[];
}

/**
 * Frontend Completion, FE-8.2 — Entities, first checkpoint to actually
 * call `GET /entities` anywhere in this app (see `actions.ts`'s own
 * doc comment — `EntitySelector.tsx` is a raw text input, not a
 * fetch-backed dropdown, a genuine correction of what would have been
 * a reasonable but wrong assumption).
 *
 * System-wide — no `EntitySelector` gate. This IS the page that
 * manages entities themselves, the same "no gate on the thing that
 * defines the gate" reasoning that would apply to any registry a
 * scoping selector elsewhere depends on.
 *
 * `parentOptions` (for `CreateEntityForm`'s own `parentEntityId`
 * `Select`) is built from this SAME fetched `entities` array — no
 * second call — every existing entity is offered as a possible parent,
 * including ones that are themselves already a subsidiary of another
 * (multi-level hierarchies are allowed server-side, confirmed directly:
 * `getHierarchyChain` walks `parentEntityId` with no depth limit).
 *
 * `parentEntityId` is resolved to a real code/name for display via a
 * `parentById` map built from the same array — the same "resolve an
 * opaque foreign id to a real label via an already-fetched list"
 * pattern this app's history has used repeatedly (BOQ resolving
 * `projectId`, IP rules resolving `userId`).
 *
 * NOW BUILT (was deferred at FE-8.2): full field-by-field editing
 * (`PATCH`) and the hierarchy-chain view (`GET /:id/hierarchy`) live at
 * `/entities/[id]` — see that route's own doc comment. This page's own
 * `Code` column links there (added in that same follow-on checkpoint,
 * matching `/users/page.tsx`'s own Code-links-to-detail precedent).
 *
 * ADDENDUM (FC-1.4) — the entities table now opts into `DataTable`'s
 * new `bulkActions` prop, as this checkpoint's one real demonstrated
 * usage — see `BulkDeactivateEntitiesButton.tsx`'s own doc comment for
 * why Entities specifically (it already had the single-row equivalent
 * to extend).
 */
export default async function EntitiesPage() {
  let entities: EntityRow[] | null = null;
  let error: string | null = null;
  try {
    entities = await fetchApi<EntityRow[]>('/entities');
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load entities.';
  }

  const parentOptions: SelectOption[] = (entities ?? []).map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }));
  const parentById = new Map((entities ?? []).map((e) => [e.id, `${e.code} — ${e.name}`]));

  return (
    <PageContainer>
      <PageHeader
        title="Entities"
        subtitle="Legal entities and their consolidation hierarchy — system-wide, not scoped to an entity."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entities' }]}
      />

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      {entities && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total entities" value={String(entities.length)} />
            <KpiCard label="Active" value={String(entities.filter((e) => e.isActive).length)} />
            <KpiCard label="Consolidation parents" value={String(entities.filter((e) => e.isConsolidationParent).length)} />
          </section>

          <CreateEntityForm parentOptions={parentOptions} />

          <EntityTable
            entities={entities}
            parentById={parentById}
          />        </>
      )}
    </PageContainer>
  );
}
