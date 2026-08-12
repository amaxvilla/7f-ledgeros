import { ActionForm, Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { GenerateApiKeyForm } from './GenerateApiKeyForm';
import { revokeApiKey } from './actions';

export const dynamic = 'force-dynamic';

interface ApiKey {
  id: string;
  entityId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  rateLimitPerMinute: number | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  REVOKED: 'negative',
};

/**
 * Frontend Completion, Checkpoint AR — API Gateway's first page,
 * picked up from the previous checkpoint's own recommendation: the
 * backend (`ApiKeyController`/`ApiKeyService`, API Gateway Checkpoints
 * A/B — see `api-gateway.module.ts`'s own doc comment) has existed with
 * no page over it, the same "backend exists, page doesn't" shape
 * `my-security` itself was before its own first checkpoint.
 *
 * Entity-scoped (`GET /api-gateway/keys?entityId=`, `ApiKeyController.findAll`
 * requires `api_gateway.view`) — `EntitySelector` used the same way
 * Payments/Recruitment/CRM/etc. all already do, unlike `my-security`
 * (user-scoped, no `EntitySelector`) or `security` (system-wide, no
 * `EntitySelector` either). API keys belong to an `Entity`
 * (`GenerateApiKeyDto.entityId`), so this page follows the majority
 * pattern, not either of those two exceptions.
 *
 * NO KPI section — confirmed by checking `dashboard.controller.ts`
 * before writing this page, not assumed: no `api-gateway-overview`
 * aggregate exists yet, the same "don't build a page section for an
 * endpoint that doesn't exist" discipline `payments/page.tsx`'s own doc
 * comment already established when it passed over Transfer APIs for
 * lacking one. A KPI section is a reasonable future addition once such
 * an aggregate exists.
 *
 * `keyPrefix` (not the full key) is the only identifying value ever
 * displayed in this list — `ApiKeyService.findKeys`'s own explicit
 * `select` never returns `keyHash`, and the plaintext key itself only
 * ever exists in `GenerateApiKeyForm`'s one-time reveal panel. This
 * page's own list can't and shouldn't recover it.
 *
 * Revoke used the same per-row `<form action={revokeApiKey.bind(null,
 * k.id)}>` pattern `my-security/page.tsx` originally established for its
 * own Sessions/Devices tables — both switched to `ActionForm`
 * (`@7f/ui`) in the same checkpoint that added it, once `tsc --noEmit`
 * confirmed the raw DOM `action` attribute doesn't typecheck against a
 * state-returning action under this app's pinned React 18 (see
 * `ActionForm`'s own doc comment for the full reasoning — the same
 * fix `LogoutButton` made once for `onLogout`, generalized once five
 * call sites needed it at once). Still hidden for already-revoked keys
 * (a second revoke would just hit `ApiKeyService.revokeKey`'s own
 * `ConflictException` for no benefit, the same reasoning `my-security`'s
 * own "revoke all other sessions" button is hidden when there's
 * nothing to revoke) — that condition is unchanged by the switch.
 */
export default async function ApiGatewayPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="API Keys" subtitle="Enter an entity ID to view its API keys." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let keys: ApiKey[] | null = null;
  let error: string | null = null;
  try {
    keys = await fetchApi<ApiKey[]>(`/api-gateway/keys?entityId=${entityId}`);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load API keys.';
  }

  return (
    <PageContainer>
      <PageHeader title="API Keys" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {keys && (
        <section>
          <PageHeader title="Keys" />
          <GenerateApiKeyForm entityId={entityId} />
          <DataTable
            columns={[
              { header: 'Name', render: (k: ApiKey) => k.name },
              { header: 'Key', render: (k: ApiKey) => <code style={{ fontFamily: tokens.font.mono, fontSize: '12px' }}>{k.keyPrefix}…</code> },
              {
                header: 'Scopes',
                render: (k: ApiKey) =>
                  k.scopes.length === 0 ? (
                    <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>All</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(1) }}>
                      {k.scopes.map((s) => (
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ),
              },
              { header: 'Status', render: (k: ApiKey) => <Badge tone={STATUS_TONE[k.status] ?? 'neutral'}>{k.status}</Badge> },
              { header: 'Rate limit', render: (k: ApiKey) => (k.rateLimitPerMinute ? `${k.rateLimitPerMinute}/min` : 'Unlimited') },
              { header: 'Expires', render: (k: ApiKey) => (k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '—') },
              { header: 'Last used', render: (k: ApiKey) => (k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—') },
              {
                header: '',
                render: (k: ApiKey) =>
                  k.status === 'REVOKED' ? null : (
                    <ActionForm action={revokeApiKey.bind(null, k.id)}>
                      <button
                        type="submit"
                        style={{ color: tokens.color.negative, fontFamily: tokens.font.body, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Revoke
                      </button>
                    </ActionForm>
                  ),
              },
            ]}
            rows={keys}
            keyOf={(k) => k.id}
            emptyMessage="No API keys for this entity yet."
          />
        </section>
      )}
    </PageContainer>
  );
}
