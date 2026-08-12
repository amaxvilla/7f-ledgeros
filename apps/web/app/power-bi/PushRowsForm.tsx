'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { KeyValueEditor, pairsToObject, type KeyValuePair } from '../integrations/[id]/KeyValueEditor';
import { pushRows } from './actions';

/**
 * Frontend Completion, FE-9.1. Reuses `KeyValueEditor` from
 * `integrations/[id]` rather than duplicating it — `PushRowsDto.rows`
 * is `Record<string, unknown>[]`, the exact flat shape that component
 * already edits (confirmed directly against its own doc comment: "flat
 * `Record<string, unknown>` blobs... a row-per-key editor covers the
 * real shape"). The instruction against duplicating UI components
 * applies across routes, not just within one — reaching into another
 * route's component file is an unusual import path, but a real second
 * copy of the same editing logic would be the actual violation. If a
 * third consumer ever needs it, that's the natural trigger to promote
 * it into `@7f/ui` properly; not done speculatively here for a second
 * consumer that didn't exist before this checkpoint.
 *
 * Only ONE row per submission — `PushRowsDto.rows` accepts an array,
 * but a multi-row UI would mean an array of `KeyValueEditor`s (a
 * dynamic list of dynamic lists), real added complexity for a page
 * whose realistic use here is verifying the push mechanism works, not
 * bulk-loading a dataset by hand. `pushRows` can be called repeatedly
 * for more rows.
 */
export function PushRowsForm() {
  const [providerCode, setProviderCode] = React.useState('POWER_BI');
  const [providerDatasetId, setProviderDatasetId] = React.useState('');
  const [tableName, setTableName] = React.useState('');
  const [pairs, setPairs] = React.useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await pushRows({
      providerCode,
      providerDatasetId,
      tableName,
      rows: [pairsToObject(pairs)],
    });

    setPending(false);
    if (result.ok) {
      setSuccess(true);
      setPairs([{ key: '', value: '' }]);
    } else {
      setError(result.error ?? 'Failed to push rows.');
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
        <TextField label="Provider dataset ID" value={providerDatasetId} onChange={(e) => setProviderDatasetId(e.target.value)} required style={{ minWidth: '220px' }} />
        <TextField label="Table name" value={tableName} onChange={(e) => setTableName(e.target.value)} required style={{ minWidth: '200px' }} />
      </div>

      <KeyValueEditor pairs={pairs} onChange={setPairs} />

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Pushing…' : 'Push row'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Row pushed.</div>}
      </div>
    </form>
  );
}
