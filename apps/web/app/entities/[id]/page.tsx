import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EditEntityForm } from './EditEntityForm';

export const dynamic = 'force-dynamic';

interface EntitySummary {
  id: string;
  code: string;
  name: string;
}

interface EntityDetail {
  id: string;
  code: string;
  name: string;
  legalName: string;
  taxIdentificationNumber: string | null;
  registrationNumber: string | null;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  parentEntityId: string | null;
  isConsolidationParent: boolean;
  isActive: boolean;
  subsidiaries: EntitySummary[];
}

/**
 * Frontend Completion — Entities, `/entities/[id]`, FE-8.2's own
 * deferred detail-page checkpoint. `GET /entities/:id` and
 * `GET /entities/:id/hierarchy` both already existed (confirmed
 * directly) — this is the genuinely-single-item shape `/roles/[id]`
 * already has, not the "no single-item endpoint, fetch the list and
 * find by id" workaround `/work-packages/[id]`/`/land-bank/estates/[estateId]`
 * both need elsewhere in this app.
 *
 * `GET /entities` (the full list, for `EditEntityForm`'s own
 * `parentOptions`) is fetched a third time in the same `Promise.all` —
 * the register's own `page.tsx` already does the exact same three-call
 * shape isn't available here since this is a different route; no way
 * to share the register's own already-fetched array across a
 * server-rendered navigation. `parentOptions` excludes this entity's
 * own id — see `EditEntityForm.tsx`'s own doc comment for the checked
 * reason (no cycle guard anywhere on the backend).
 *
 * The hierarchy chain (`getHierarchyChain`, root-first) is rendered as
 * a simple breadcrumb-style row of codes, each linking to that
 * ancestor's own `/entities/[id]` — the chain always includes this
 * entity itself as the last element (confirmed directly:
 * `chain.unshift(current)` runs once before the `while` loop even
 * starts), so this page's own row doesn't need to separately append it.
 */
async function loadEntityDetail(id: string) {
  const [entity, hierarchy, allEntities] = await Promise.all([
    fetchApi<EntityDetail>(`/entities/${id}`),
    fetchApi<EntitySummary[]>(`/entities/${id}/hierarchy`),
    fetchApi<EntitySummary[]>('/entities'),
  ]);
  return { entity, hierarchy, allEntities };
}

export default async function EntityDetailPage({ params }: { params: { id: string } }) {
  let entity: EntityDetail | null = null;
  let hierarchy: EntitySummary[] = [];
  let allEntities: EntitySummary[] = [];
  let error: string | null = null;
  try {
    const result = await loadEntityDetail(params.id);
    entity = result.entity;
    hierarchy = result.hierarchy;
    allEntities = result.allEntities;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load entity.';
  }

  if (error || !entity) {
    return (
      <PageContainer>
        <PageHeader title="Entity detail" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entities', href: '/entities' }]} />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Entity not found.'}</div>
      </PageContainer>
    );
  }

  const parentOptions: SelectOption[] = allEntities
    .filter((e) => e.id !== entity!.id)
    .map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }));

  return (
    <PageContainer>
      <PageHeader
        title={`${entity.code} — ${entity.name}`}
        subtitle={entity.legalName}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Entities', href: '/entities' }, { label: entity.code }]}
      />

      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6) }}>
        <Badge tone={entity.isActive ? 'positive' : 'neutral'}>{entity.isActive ? 'Active' : 'Inactive'}</Badge>
        {entity.isConsolidationParent && <Badge tone="positive">Consolidation parent</Badge>}
      </div>

      <section style={{ marginBottom: tokens.space(6) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Hierarchy: </span>
        {hierarchy.map((e, i) => (
          <span key={e.id} style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
            {i > 0 && ' → '}
            {e.id === entity!.id ? (
              <strong>{e.code}</strong>
            ) : (
              <Link href={`/entities/${e.id}`} style={{ color: tokens.color.accent }}>
                {e.code}
              </Link>
            )}
          </span>
        ))}
      </section>

      <PageHeader title="Edit entity" />
      <EditEntityForm
        entityId={entity.id}
        parentOptions={parentOptions}
        initialValues={{
          code: entity.code,
          name: entity.name,
          legalName: entity.legalName,
          taxIdentificationNumber: entity.taxIdentificationNumber ?? '',
          registrationNumber: entity.registrationNumber ?? '',
          baseCurrency: entity.baseCurrency,
          fiscalYearStartMonth: String(entity.fiscalYearStartMonth),
          parentEntityId: entity.parentEntityId ?? '',
          isConsolidationParent: entity.isConsolidationParent,
        }}
      />

      <PageHeader title="Subsidiaries" />
      <DataTable
        columns={[
          { header: 'Code', render: (e: EntitySummary) => e.code },
          { header: 'Name', render: (e: EntitySummary) => e.name },
          {
            header: '',
            align: 'right',
            render: (e: EntitySummary) => (
              <Link href={`/entities/${e.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                View →
              </Link>
            ),
          },
        ]}
        rows={entity.subsidiaries}
        keyOf={(e) => e.id}
        emptyMessage="No subsidiaries under this entity."
      />
    </PageContainer>
  );
}
