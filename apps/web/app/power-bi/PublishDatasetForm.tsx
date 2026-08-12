'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { publishDataset } from './actions';

const DATA_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'dateTime', label: 'DateTime' },
];

interface ColumnRow {
  name: string;
  dataType: string;
}

/**
 * Frontend Completion, FE-9.1. `PublishDatasetDto.tables` is an array
 * of tables, each with an array of typed columns — this form covers
 * ONE table per publish call, not a dynamic table-of-tables builder.
 * `PowerBiService.publishDataset` supports multiple tables in a single
 * call, but a Power BI dataset in practice is usually built up
 * incrementally (one table added, then rows pushed, then another table
 * added) — the same reasoning `AddDependencyForm`'s own doc comment
 * gives for a single-relationship-at-a-time form over a batch one;
 * calling this action twice covers the multi-table case without a
 * second layer of dynamic array nesting in the UI.
 *
 * The column list, not the row list, is what's dynamic here — each
 * column needs a typed `dataType` (`Select`, not free text: Power BI's
 * dataset-creation API itself only accepts these four values, so a
 * free-text field would just move a 400 error later instead of
 * preventing it).
 *
 * ADDENDUM (Mobile Responsiveness rollout) — both `Button` usages' own
 * compact `style` override removed (Remove/+ Add column), the same fix
 * this rollout applied to every other dynamic line-item form across
 * the app — see `KeyValueEditor.tsx`'s own addendum (fixed in the same
 * checkpoint) for the full list of siblings already fixed earlier.
 * Also confirmed directly, named rather than fixed here (out of this
 * checkpoint's own scope): unlike every sibling form just listed, this
 * component has NO test file anywhere (`apps/web/app/power-bi/` has
 * only `PowerBiEmbed.test.tsx`, a different component) — a second
 * confirmed instance of the same "zero test coverage" gap
 * `SnagActions.tsx` was already found to have earlier in this rollout.
 *
 * ADDENDUM (Stage FC-1 return, following FC-1.7's own recommendation)
 * — that gap is now closed: `__tests__/PublishDatasetForm.test.tsx`
 * added, 15 cases. Worth recording two real behavioral findings the
 * tests themselves had to get right rather than assume: (1) unlike
 * this app's other dynamic line-item forms (e.g. `SubdividePlotsForm`),
 * `removeColumn`'s own "Remove" button has NO `disabled={columns.length
 * === 1}` guard — a user genuinely can remove every column and submit
 * `columns: []`, confirmed directly and tested as real behavior, not
 * assumed to match the more common one-row-minimum pattern; (2) unlike
 * every `Create*Form` in this app, this form does NOT reset after a
 * successful submit — the submitted values stay visible alongside the
 * returned `providerDatasetId`, consistent with that id being
 * explicitly one-time/uncopyable-later (see this component's own
 * success-message text), so clearing the form the user might still
 * want to reference would work against that same warning.
 */
export function PublishDatasetForm() {
  const [providerCode, setProviderCode] = React.useState('POWER_BI');
  const [datasetName, setDatasetName] = React.useState('');
  const [tableName, setTableName] = React.useState('');
  const [columns, setColumns] = React.useState<ColumnRow[]>([{ name: '', dataType: 'string' }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  function updateColumn(index: number, field: keyof ColumnRow, value: string) {
    setColumns((cols) => cols.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addColumn() {
    setColumns((cols) => [...cols, { name: '', dataType: 'string' }]);
  }

  function removeColumn(index: number) {
    setColumns((cols) => cols.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    const result = await publishDataset({
      providerCode,
      datasetName,
      tables: [{ name: tableName, columns: columns.filter((c) => c.name.trim()) }],
    });

    setPending(false);
    if (result.ok && result.data) {
      setResult(result.data.providerDatasetId);
    } else {
      setError(result.error ?? 'Failed to publish dataset.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(3),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
        <TextField label="Provider code" value={providerCode} onChange={(e) => setProviderCode(e.target.value)} required style={{ minWidth: '160px' }} />
        <TextField label="Dataset name" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} required style={{ minWidth: '220px' }} />
        <TextField label="Table name" value={tableName} onChange={(e) => setTableName(e.target.value)} required style={{ minWidth: '200px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2) }}>
        {columns.map((col, index) => (
          <div key={index} style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end' }}>
            <TextField label={`Column name (${index + 1})`} value={col.name} onChange={(e) => updateColumn(index, 'name', e.target.value)} style={{ minWidth: '200px' }} />
            <Select label={`Data type (${index + 1})`} value={col.dataType} onChange={(e) => updateColumn(index, 'dataType', e.target.value)} options={DATA_TYPE_OPTIONS} style={{ minWidth: '140px' }} />
            <Button type="button" variant="secondary" onClick={() => removeColumn(index)}>
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addColumn} style={{ alignSelf: 'flex-start' }}>
          + Add column
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Publishing…' : 'Publish dataset'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>

      {result && (
        <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Published. Provider dataset ID (copy this — it isn&apos;t stored anywhere): <strong>{result}</strong>
        </div>
      )}
    </form>
  );
}
