'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { importBankStatement } from './actions';

interface Line {
  transactionDate: string;
  description: string;
  reference: string;
  amount: string;
}

const EMPTY_LINE: Line = { transactionDate: '', description: '', reference: '', amount: '0' };

/**
 * Frontend Completion, FE-3.6 — same dynamic-line pattern as
 * `CreateJournalEntryForm`/`CreateRequisitionForm`. `ImportBankStatementDto.lines`
 * requires `@ArrayMinSize(1)` (confirmed directly), one starting line.
 * `amount` is signed (positive = deposit, negative = withdrawal — the
 * DTO's own inline comment, confirmed directly), so this form doesn't
 * split it into separate debit/credit fields the way
 * `CreateJournalEntryForm` does for journal lines — it's a single
 * signed `TextField` per line, matching what the DTO actually expects.
 *
 * On success this renders the returned statement id inline rather than
 * navigating anywhere or revalidating a list — see `actions.ts`'s own
 * doc comment on why `importBankStatement` returns `id`: there's no
 * `GET /bank-reconciliation/statements` to browse to afterward, so the
 * id shown here is what the user copies into `CreateSessionForm`'s own
 * `statementId` field next.
 *
 * ADDENDUM (FE-10.32, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add line),
 * the same fix this rollout has now applied to every dynamic
 * line-item form across the app. Verified directly against this
 * file's own current source before fixing.
 */
export function ImportStatementForm({ entityId }: { entityId: string }) {
  const [bankAccountId, setBankAccountId] = React.useState('');
  const [statementDate, setStatementDate] = React.useState('');
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [openingBalance, setOpeningBalance] = React.useState('0');
  const [closingBalance, setClosingBalance] = React.useState('0');
  const [lines, setLines] = React.useState<Line[]>([{ ...EMPTY_LINE }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statementId, setStatementId] = React.useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // We import it dynamically to avoid dependency issues if it's not imported at the top
      const { parseImportFileAction } = await import('../../lib/importActions');
      const res = await parseImportFileAction(formData);
      if (res.ok) {
        const newLines = res.data.rows.map((row: any) => ({
          transactionDate: row.transactionDate || '',
          description: row.description || '',
          reference: row.reference || '',
          amount: row.amount || '0',
        }));
        if (newLines.length > 0) setLines(newLines);
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPending(false);
      if (e.target) e.target.value = '';
    }
  }

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setStatementId(null);

    const result = await importBankStatement({
      entityId,
      bankAccountId,
      statementDate,
      periodStart,
      periodEnd,
      openingBalance: Number(openingBalance),
      closingBalance: Number(closingBalance),
      lines: lines.map((line) => ({
        transactionDate: line.transactionDate,
        description: line.description,
        reference: line.reference || undefined,
        amount: Number(line.amount),
      })),
    });

    setPending(false);
    if (result.ok) {
      setBankAccountId('');
      setStatementDate('');
      setPeriodStart('');
      setPeriodEnd('');
      setOpeningBalance('0');
      setClosingBalance('0');
      setLines([{ ...EMPTY_LINE }]);
      setStatementId(result.id ?? null);
    } else {
      setError(result.error ?? 'Failed to import bank statement.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', gap: tokens.space(4), justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: tokens.font.body }}>Import Statement</h3>
        <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/STATEMENT?format=csv`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (CSV)</a>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/STATEMENT?format=xlsx`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (XLSX)</a>
          <label style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 8px', border: `1px solid ${tokens.color.border}`, borderRadius: '4px' }}>
            Upload CSV/XLSX
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <TextField label="Bank account ID" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required style={{ minWidth: '200px' }} />
        <TextField label="Statement date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required style={{ minWidth: '160px' }} />
        <TextField label="Period start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required style={{ minWidth: '160px' }} />
        <TextField label="Period end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required style={{ minWidth: '160px' }} />
        <TextField label="Opening balance" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} required style={{ minWidth: '140px' }} />
        <TextField label="Closing balance" type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} required style={{ minWidth: '140px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Statement lines</span>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Transaction date (line ${index + 1})`}
              type="date"
              value={line.transactionDate}
              onChange={(e) => updateLine(index, 'transactionDate', e.target.value)}
              required
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Description (line ${index + 1})`}
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              required
              style={{ minWidth: '220px' }}
            />
            <TextField
              label={`Reference (line ${index + 1}, optional)`}
              value={line.reference}
              onChange={(e) => updateLine(index, 'reference', e.target.value)}
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Amount (line ${index + 1})`}
              type="number"
              value={line.amount}
              onChange={(e) => updateLine(index, 'amount', e.target.value)}
              required
              style={{ minWidth: '140px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addLine}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add line
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Importing…' : 'Import statement'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {statementId && (
          <div style={{ fontFamily: tokens.font.mono, fontSize: '13px', color: tokens.color.positive }}>
            Imported. Statement ID: {statementId}
          </div>
        )}
      </div>
    </form>
  );
}
