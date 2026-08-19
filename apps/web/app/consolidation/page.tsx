import { fetchApi } from '../../lib/api';
import { ConsolidationTable } from './ConsolidationTable';
import { PageContainer, PageHeader, KpiCard } from '@7f/ui';

export const dynamic = 'force-dynamic';

type AnyRow = Record<string, unknown>;

function DynamicTable({ value }: { value: unknown }) {
  return <ConsolidationTable value={value} />;
}

export default async function ConsolidationPage({
  searchParams,
}: {
  searchParams: {
    groupId?: string;
    fiscalPeriodId?: string;
  };
}) {
  const groupId = searchParams.groupId?.trim() ?? '';
  const fiscalPeriodId = searchParams.fiscalPeriodId?.trim() ?? '';

  const groups = await fetchApi<AnyRow[]>('/consolidation/groups');

  let trialBalance: unknown = null;
  let profitAndLoss: unknown = null;
  let balanceSheet: unknown = null;
  let error = '';

  if (groupId) {
    const query = fiscalPeriodId
      ? `?fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}`
      : '';

    try {
      [trialBalance, profitAndLoss, balanceSheet] = await Promise.all([
        fetchApi<unknown>(
          `/consolidation/groups/${encodeURIComponent(groupId)}/trial-balance${query}`,
        ),
        fetchApi<unknown>(
          `/consolidation/groups/${encodeURIComponent(groupId)}/profit-and-loss${query}`,
        ),
        fetchApi<unknown>(
          `/consolidation/groups/${encodeURIComponent(groupId)}/balance-sheet${query}`,
        ),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load consolidation reports.';
    }
  }

  const balanceInfo =
    balanceSheet &&
    typeof balanceSheet === 'object' &&
    'balances' in balanceSheet
      ? (balanceSheet as { balances: boolean })
      : null;

  return (
    <PageContainer>
      <PageHeader
        title="Consolidation"
        subtitle="Group-level financial reporting and ownership."
      />

      {error ? (
        <div
          style={{
            padding: 14,
            marginBottom: 20,
            border: '1px solid var(--ledgeros-border)',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      ) : null}

      <section style={{ marginBottom: 28 }}>
        <PageHeader title="Consolidation Groups" />

        <form
          method="GET"
          style={{
            display: 'grid',
            gap: 10,
            maxWidth: 800,
            marginBottom: 16,
          }}
        >
          <select
            name="groupId"
            defaultValue={groupId}
            style={{
              padding: 10,
              borderRadius: 7,
              border: '1px solid var(--ledgeros-border)',
            }}
          >
            <option value="">Select consolidation group</option>

            {groups.map((group) => (
              <option key={String(group.id)} value={String(group.id)}>
                {String(group.code ?? '')} - {String(group.name ?? '')}
              </option>
            ))}
          </select>

          <input
            name="fiscalPeriodId"
            defaultValue={fiscalPeriodId}
            placeholder="Fiscal Period ID"
            style={{
              padding: 10,
              borderRadius: 7,
              border: '1px solid var(--ledgeros-border)',
            }}
          />

          <button
            type="submit"
            style={{
              width: 'fit-content',
              padding: '9px 14px',
              borderRadius: 7,
              border: '1px solid var(--ledgeros-border)',
              cursor: 'pointer',
            }}
          >
            Load consolidation
          </button>
        </form>

        <DynamicTable value={groups} />
      </section>

      {groupId ? (
        <>
          <section style={{ marginBottom: 28 }}>
            <PageHeader title="Consolidated Trial Balance" />
            <DynamicTable value={trialBalance} />
          </section>

          <section style={{ marginBottom: 28 }}>
            <PageHeader title="Consolidated Profit & Loss" />
            <DynamicTable value={profitAndLoss} />
          </section>

          <section style={{ marginBottom: 28 }}>
            <PageHeader title="Consolidated Balance Sheet" />
            <DynamicTable value={balanceSheet} />

            {balanceInfo ? (
              <div style={{ marginTop: 14 }}>
                <KpiCard
                  label="Balances"
                  value={balanceInfo.balances ? 'Yes' : 'No'}
                  tone={balanceInfo.balances ? 'positive' : 'warning'}
                />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}