import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateRoleForm } from './CreateRoleForm';
import { RolesTable } from './RolesTables';

export const dynamic = 'force-dynamic';

interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

async function loadRoles() {
  const [roles, permissions] = await Promise.all([
    fetchApi<RoleSummary[]>('/roles'),
    fetchApi<{ id: string; code: string; module: string; description: string | null }[]>('/permissions'),
  ]);
  return { roles, permissions };
}

/**
 * Frontend Completion, FE-6 — Roles & Permissions, the register half.
 * `GET /roles`/`GET /permissions` are both NEW this checkpoint — see
 * `apps/api/src/roles/roles.controller.ts`'s own doc comment for the
 * full "why this didn't exist before, why it's scoped this narrowly"
 * reasoning; not repeated here.
 *
 * NO `EntitySelector` — `Role`/`Permission` are both system-wide, same
 * structural posture `/security` already established for a different
 * kind of non-entity-scoped page (see that page's own doc comment).
 *
 * `permissions` (the full catalog) is fetched here only to show its
 * total count as a KPI — the actual per-module checklist UI lives on
 * `/roles/[id]`, which fetches its own copy. Fetching it twice (once
 * here for a count, once there for the checklist) rather than passing
 * it through navigation state: this app has no cross-page data-passing
 * mechanism anywhere else (confirmed by checking how every other
 * register-to-detail pair in this app works — `/land-bank` ->
 * `/land-bank/estates/[estateId]`, `/work-packages` ->
 * `/work-packages/[id]` — all independently re-fetch on the detail
 * page rather than receiving props from the register), so this follows
 * that same precedent rather than inventing a new one for one KPI
 * number.
 *
 * "Manage" links to `/roles/[id]` — reuses the "View"/"Master plans →"
 * link-in-a-DataTable-column shape `land-bank/page.tsx` already
 * established for Estates.
 */
export default async function RolesPage() {
  let data: Awaited<ReturnType<typeof loadRoles>> | null = null;
  let error: string | null = null;
  try {
    data = await loadRoles();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load roles.';
  }

  const systemCount = data ? data.roles.filter((r) => r.isSystem).length : 0;
  const customCount = data ? data.roles.length - systemCount : 0;

  return (
    <PageContainer>
      <PageHeader title="Roles & Permissions" subtitle="System-wide — not scoped to a single entity" />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Roles" value={String(data.roles.length)} />
            <KpiCard label="System roles" value={String(systemCount)} />
            <KpiCard label="Custom roles" value={String(customCount)} />
            <KpiCard label="Permission catalog" value={String(data.permissions.length)} />
          </section>

          <section>
            <PageHeader title="Roles" />
            <CreateRoleForm />
            <RolesTable rows={data.roles} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
