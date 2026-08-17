import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { PageContainer, PageHeader, KpiCard, DataTable } from '@7f/ui';
import { updateIfrsDisclosure } from './actions';

export const dynamic = 'force-dynamic';

type AnyRow = Record<string, unknown>;

function asRows(value: unknown): AnyRow[] {
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatCurrency(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DynamicTable({ value, emptyMessage }: { value: unknown; emptyMessage: string }) {
  const rows = asRows(value);

  if (!rows.length) {
    return <div style={{ padding: 16, color: 'var(--ledgeros-text-secondary)' }}>{emptyMessage}</div>;
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
        render: (row: AnyRow) => displayValue(row[key]),
      }))}
      emptyMessage={emptyMessage}
    />
  );
}

function NoteCard({
  noteKey,
  note,
  entityId,
  fiscalPeriodId,
}: {
  noteKey: string;
  note: unknown;
  entityId: string;
  fiscalPeriodId: string;
}) {
  const current =
    note && typeof note === 'object' && 'current' in note
      ? (note as { current: unknown }).current
      : note;

  const content =
    current &&
    typeof current === 'object' &&
    'content' in current
      ? String((current as { content?: unknown }).content ?? '')
      : null;

  const accounts =
    current &&
    typeof current === 'object' &&
    'accounts' in current
      ? (current as { accounts?: unknown }).accounts
      : null;

  return (
    <section
      style={{
        border: '1px solid var(--ledgeros-border)',
        borderRadius: 10,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <PageHeader title={noteKey.replace(/([A-Z])/g, ' $1')} />

      {accounts ? (
        <DynamicTable value={accounts} emptyMessage="No note accounts for this period." />
      ) : null}

      {content !== null ? (
        <form action={updateIfrsDisclosure} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="fiscalPeriodId" value={fiscalPeriodId} />
          <input type="hidden" name="note" value={noteKey} />

          <label style={{ fontWeight: 600 }}>Narrative disclosure</label>
          <textarea
            name="content"
            defaultValue={content}
            rows={7}
            style={{
              width: '100%',
              border: '1px solid var(--ledgeros-border)',
              borderRadius: 8,
              padding: 12,
              font: 'inherit',
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
            Save disclosure
          </button>
        </form>
      ) : null}

      {current && typeof current === 'object' && !accounts && content === null ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            margin: 0,
            fontSize: 12,
          }}
        >
          {JSON.stringify(current, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: {
    entityId?: string;
    fiscalPeriodId?: string;
    comparativeFiscalPeriodId?: string;
    segmentType?: string;
  };
}) {
  const entityId = searchParams.entityId?.trim() ?? '';
  const fiscalPeriodId = searchParams.fiscalPeriodId?.trim() ?? '';
  const comparativeFiscalPeriodId = searchParams.comparativeFiscalPeriodId?.trim() ?? '';
  const segmentType = searchParams.segmentType?.trim() ?? '';

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Finance Reports"
          subtitle="Enter an entity ID and optional fiscal period to load extended finance reporting."
        />

        <form method="GET" style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
          <input
            name="entityId"
            placeholder="Entity ID"
            required
            style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
          />
          <input
            name="fiscalPeriodId"
            placeholder="Fiscal Period ID"
            style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
          />
          <input
            name="comparativeFiscalPeriodId"
            placeholder="Comparative Fiscal Period ID"
            style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
          />
          <select
            name="segmentType"
            defaultValue=""
            style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
          >
            <option value="">All segments</option>
            <option value="ENTITY">Entity</option>
            <option value="PROJECT">Project</option>
            <option value="DEPARTMENT">Department</option>
            <option value="COST_CENTER">Cost Centre</option>
            <option value="FUNDING_SOURCE">Funding Source</option>
            <option value="BUSINESS_UNIT">Business Unit</option>
          </select>
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
            Load finance reports
          </button>
        </form>
      </PageContainer>
    );
  }

  let error = '';

  let trialBalance: unknown = null;
  let financialRatios: unknown = null;
  let segmentReporting: unknown = null;
  let ifrsNotes: any = null;

  try {
    const trialQuery = fiscalPeriodId ? `&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}` : '';
    const segmentQuery = fiscalPeriodId
      ? `?entityId=${encodeURIComponent(entityId)}&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}${segmentType ? `&segmentType=${encodeURIComponent(segmentType)}` : ''}`
      : '';

    const ratiosQuery = fiscalPeriodId ? `&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}` : '';

    const ifrsQuery =
      fiscalPeriodId
        ? `?entityId=${encodeURIComponent(entityId)}&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}${comparativeFiscalPeriodId ? `&comparativeFiscalPeriodId=${encodeURIComponent(comparativeFiscalPeriodId)}` : ''}`
        : '';

    const [tb, ratios, segments, notes] = await Promise.all([
      fetchApi<unknown>(`/reporting/trial-balance?entityId=${encodeURIComponent(entityId)}${trialQuery}`),
      fetchApi<unknown>(`/reporting/financial-ratios?entityId=${encodeURIComponent(entityId)}${ratiosQuery}`),
      fiscalPeriodId
        ? fetchApi<unknown>(`/reporting/segment-reporting${segmentQuery}`)
        : Promise.resolve([]),
      fiscalPeriodId
        ? fetchApi<unknown>(`/reporting/ifrs-notes${ifrsQuery}`)
        : Promise.resolve(null),
    ]);

    trialBalance = tb;
    financialRatios = ratios;
    segmentReporting = segments;
    ifrsNotes = notes;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load extended finance reports.';
  }

  const noteEntries =
    ifrsNotes?.notes && typeof ifrsNotes.notes === 'object'
      ? Object.entries(ifrsNotes.notes)
      : [];

  return (
    <PageContainer>
      <PageHeader
        title="Finance Reports"
        subtitle={`Entity ${entityId}${fiscalPeriodId ? ` • Fiscal period ${fiscalPeriodId}` : ''}`}
      />

      <form method="GET" style={{ display: 'grid', gap: 10, maxWidth: 900, marginBottom: 24 }}>
        <input type="hidden" name="entityId" value={entityId} />
        <input
          name="fiscalPeriodId"
          defaultValue={fiscalPeriodId}
          placeholder="Fiscal Period ID"
          style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
        />
        <input
          name="comparativeFiscalPeriodId"
          defaultValue={comparativeFiscalPeriodId}
          placeholder="Comparative Fiscal Period ID"
          style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
        />
        <select
          name="segmentType"
          defaultValue={segmentType}
          style={{ padding: 10, borderRadius: 7, border: '1px solid var(--ledgeros-border)' }}
        >
          <option value="">All segments</option>
          <option value="ENTITY">Entity</option>
          <option value="PROJECT">Project</option>
          <option value="DEPARTMENT">Department</option>
          <option value="COST_CENTER">Cost Centre</option>
          <option value="FUNDING_SOURCE">Funding Source</option>
          <option value="BUSINESS_UNIT">Business Unit</option>
        </select>
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
          Refresh
        </button>
      </form>

      {error ? (
        <div
          style={{
            padding: 14,
            marginBottom: 20,
            borderRadius: 8,
            border: '1px solid var(--ledgeros-border)',
          }}
        >
          {error}
        </div>
      ) : null}

      <section style={{ marginBottom: 28 }}>
        <PageHeader title="Trial Balance" />
        <DynamicTable value={trialBalance} emptyMessage="No trial balance rows returned." />
      </section>

      <section style={{ marginBottom: 28 }}>
        <PageHeader title="Financial Ratios" />
        <DynamicTable value={financialRatios} emptyMessage="No financial ratios returned." />
      </section>

      <section style={{ marginBottom: 28 }}>
        <PageHeader title="Segment Reporting" />
        <DynamicTable value={segmentReporting} emptyMessage="No segment reporting rows returned." />
      </section>

      {ifrsNotes ? (
        <section>
          <PageHeader title="IFRS Notes" subtitle={ifrsNotes.periodName ?? undefined} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Notes" value={String(noteEntries.length)} />
            <KpiCard label="Entity" value={String(ifrsNotes.entityId ?? entityId)} />
            <KpiCard label="Period" value={String(ifrsNotes.periodName ?? fiscalPeriodId)} />
          </div>

          {noteEntries.map(([key, value]) => (
            <NoteCard
              key={key}
              noteKey={key}
              note={value}
              entityId={entityId}
              fiscalPeriodId={fiscalPeriodId}
            />
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {(['pdf-ready', 'excel-ready', 'powerbi'] as const).map((format) => (
              <a
                key={format}
                href={`/api/finance-reports/ifrs-export?entityId=${encodeURIComponent(entityId)}&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}&format=${format}`}
                style={{
                  padding: '9px 12px',
                  border: '1px solid var(--ledgeros-border)',
                  borderRadius: 7,
                  textDecoration: 'none',
                }}
              >
                {format}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
