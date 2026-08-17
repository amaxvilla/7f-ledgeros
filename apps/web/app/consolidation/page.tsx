import { fetchApi, formatCurrency } from '../../lib/api';
import { PageContainer, PageHeader, DataTable, KpiCard } from '@7f/ui';

export const dynamic = 'force-dynamic';

type AnyRow = Record<string, unknown>;

function rowsOf(value: unknown): AnyRow[] {
  if (Array.isArray(value)) return value as AnyRow[];

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    for (const key of ['rows', 'data', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as AnyRow[];
    }

    return [obj];
  }

  return [];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatCurrency(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DynamicTable({ value }: { value: unknown }) {
  const rows = rowsOf(value);

  if (!rows.length) {
    return <div style={{ padding: 16 }}>No data returned.</div>;
  }

  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  return (
    <DataTable
      keyOf={(row) =>
        String(
          row.id ??
            row.key ??
            row.code ??
            row.account_id ??
            row.account_code ??
            JSON.stringify(row),
        )
      }
      rows={rows}
      columns={keys.map((key) => ({
        header: key.replace(/_/g, ' '),
        render: (row: AnyRow) => text(row[key]),
      }))}
      emptyMessage="No records."
    />
  );
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