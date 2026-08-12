import Link from 'next/link';
import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { RolePermissionsForm, type PermissionOption } from './RolePermissionsForm';

export const dynamic = 'force-dynamic';

interface RoleDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { id: string; code: string; module: string; description: string | null }[];
}

async function loadRoleDetail(roleId: string) {
  const [role, allPermissions] = await Promise.all([
    fetchApi<RoleDetail>(`/roles/${roleId}`),
    fetchApi<PermissionOption[]>('/permissions'),
  ]);
  return { role, allPermissions };
}

/**
 * Frontend Completion, FE-6 — Roles & Permissions, the detail half.
 * `GET /roles/:id` is a genuinely single-item endpoint (unlike the
 * "no single-item endpoint, fetch the list and find by id" workaround
 * `/work-packages/[id]` and `/land-bank/estates/[estateId]` both needed
 * elsewhere in this app) — this whole module was built fresh this
 * checkpoint, so a real by-id route was written rather than a
 * workaround being needed for a pre-existing gap.
 *
 * `GET /permissions` is fetched again here (also fetched on `/roles`
 * for its own KPI count) — see that page's own doc comment for why
 * re-fetching rather than passing through navigation is this app's
 * established precedent, not a new one invented here.
 */
export default async function RoleDetailPage({ params }: { params: { id: string } }) {
  let role: RoleDetail | null = null;
  let allPermissions: PermissionOption[] = [];
  let error: string | null = null;
  try {
    const result = await loadRoleDetail(params.id);
    role = result.role;
    allPermissions = result.allPermissions;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load role.';
  }

  if (error || !role) {
    return (
      <PageContainer>
        <PageHeader title="Role detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Role not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/roles" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Roles
          </Link>
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/roles" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Roles
        </Link>
      </p>

      <PageHeader title={`${role.code} — ${role.name}`} subtitle={role.description ?? undefined} />

      <div style={{ marginBottom: tokens.space(6) }}>
        <Badge tone={role.isSystem ? 'neutral' : 'positive'}>{role.isSystem ? 'System role' : 'Custom role'}</Badge>
      </div>

      <section>
        <PageHeader title="Permissions" subtitle={`${role.permissions.length} of ${allPermissions.length} assigned`} />
        <RolePermissionsForm
          roleId={role.id}
          allPermissions={allPermissions}
          initiallyChecked={role.permissions.map((p) => p.code)}
        />
      </section>
    </PageContainer>
  );
}
