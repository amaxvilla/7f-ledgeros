import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { LinkMonoAccountForm } from './LinkMonoAccountForm';
import { RevokeLinkedAccountButton } from './RevokeLinkedAccountButton';
import { BankIntegrationLinkedAccountsTable } from './BankIntegrationTables';

export const dynamic = 'force-dynamic';

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  currency: string;
}

interface MonoLinkedAccount {
  id: string;
  institutionName: string | null;
  accountNumberMasked: string | null;
  status: string;
  lastSyncedAt: string | null;
  reauthRequiredAt: string | null;
}

interface MonoOverview {
  entityId: string;
  totalLinked: number;
  byStatus: { ACTIVE: number; REVOKED: number; REQUIRES_REAUTH: number };
  needsReauth: { id: string; institutionName: string | null; accountNumberMasked: string | null; reauthRequiredAt: string | null }[];
  staleActiveAccounts: { id: string; institutionName: string | null; accountNumberMasked: string | null; lastSyncedAt: string | null }[];
}

/**
 * Frontend Completion — Bank Integration (Mono), the next module page
 * after Treasury, and the first page whose read side genuinely can't
 * be a single flat `entityId`-scoped `Promise.all` the way every prior
 * page's `load*` function has been.
 *
 * `GET /bank-integration/mono/linked-accounts` (MonoLinkedAccountController)
 * takes `bankAccountId`, not `entityId` — there is no entity-scoped list
 * endpoint for linked accounts themselves. `GET /dashboard/mono-linked-accounts-overview`
 * IS entity-scoped, but (read directly from
 * `MonoLinkedAccountService.getOverview` rather than assumed) only
 * returns status *counts* plus two operationally-filtered subsets
 * (`needsReauth`, `staleActiveAccounts`) — not the full per-account
 * list a `DataTable` needs. So this page's own `loadBankIntegration`
 * does what no prior page has needed to: fetch the entity's bank
 * accounts first (`GET /treasury/bank-accounts`, already used read-only
 * by Treasury's own page for its create form, not yet for a list here),
 * then fan out one `GET .../linked-accounts?bankAccountId=` call per
 * bank account, and flatten the results — attaching each linked
 * account's own parent bank account name for display, since the linked-
 * account rows themselves don't carry it.
 *
 * `LinkMonoAccountForm`'s `bankAccountId` field is a real `Select` built
 * from this page's own bank-accounts fetch (not a plain TextField the
 * way most other forms' id fields are) — bank accounts are a small,
 * already-fetched, genuinely enumerable set for this entity, the same
 * reasoning `CreateVacancyForm`'s own `jobRequisitionId` Select upgrade
 * used, applied here from the start rather than as a later upgrade.
 *
 * `code` (the Mono Connect widget's one-time consent code,
 * `LinkMonoAccountDto.code`) stays a plain TextField — this app has no
 * Mono Connect JS widget wired up anywhere to produce that code
 * automatically, the same "no picker UI exists yet for this id-shaped
 * value" reasoning `CreateMortgageApplicationForm`'s own `allocationId`
 * doc comment gives, applied to a widget-sourced token instead of a
 * database id.
 *
 * `BankAccount.accountNumber` is `@MaskFields`-guarded on the
 * `/treasury/bank-accounts` endpoint (same as `TreasuryPage`'s own
 * `facilityAmount`/`interestRatePercent`) — this page never renders it
 * (neither the table nor the form's Select options use it, only
 * `accountName`/`bankName`), so it deliberately doesn't need its own
 * `renderMaybeMasked`-style helper the way `treasury/page.tsx` does.
 */
async function loadBankIntegration(entityId: string) {
  const [overview, bankAccounts] = await Promise.all([
    fetchApi<MonoOverview>(`/dashboard/mono-linked-accounts-overview?entityId=${entityId}`),
    fetchApi<BankAccount[]>(`/treasury/bank-accounts?entityId=${entityId}`),
  ]);

  const linkedByAccount = await Promise.all(
    bankAccounts.map((account) => fetchApi<MonoLinkedAccount[]>(`/bank-integration/mono/linked-accounts?bankAccountId=${account.id}`)),
  );

  const linkedAccounts = linkedByAccount.flatMap((list, i) =>
    list.map((linked) => ({ ...linked, bankAccountName: `${bankAccounts[i].accountName} (${bankAccounts[i].bankName})` })),
  );

  return { overview, bankAccounts, linkedAccounts };
}

type BankIntegrationRow = Awaited<ReturnType<typeof loadBankIntegration>>['linkedAccounts'][number];

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  REVOKED: 'neutral',
  REQUIRES_REAUTH: 'warning',
};

export default async function BankIntegrationPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Bank Integration" subtitle="Enter an entity ID to view its linked bank accounts." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadBankIntegration>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBankIntegration(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load bank integration data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Bank Integration" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Linked accounts" value={String(data.overview.totalLinked)} />
            <KpiCard label="Active" value={String(data.overview.byStatus.ACTIVE)} tone="positive" />
            <KpiCard
              label="Needs re-auth"
              value={String(data.overview.byStatus.REQUIRES_REAUTH)}
              tone={data.overview.byStatus.REQUIRES_REAUTH > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <section>
            <PageHeader title="Linked accounts" />
            <LinkMonoAccountForm bankAccounts={data.bankAccounts.map((a) => ({ id: a.id, accountName: a.accountName, bankName: a.bankName }))} />
            <BankIntegrationLinkedAccountsTable rows={data.linkedAccounts} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
