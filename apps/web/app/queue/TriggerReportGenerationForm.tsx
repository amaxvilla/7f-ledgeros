'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { triggerReportGeneration } from './actions';

const REPORT_KEY_OPTIONS = [
  { value: 'budget-vs-actual', label: 'Budget vs Actual' },
  { value: 'project-profitability', label: 'Project Profitability' },
  { value: 'vendor-aging', label: 'Vendor Aging' },
  { value: 'customer-aging', label: 'Customer Aging' },
  { value: 'cash-forecast', label: 'Cash Forecast' },
  { value: 'bank-reconciliation-summary', label: 'Bank Reconciliation Summary' },
  { value: 'consolidated-trial-balance', label: 'Consolidated Trial Balance' },
];

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

/**
 * Completion Roadmap, FC-3.1 — the third of `JobsController`'s four
 * trigger forms, closing one of the two gaps FE-8.5's own doc comment
 * named directly (`actions.ts`'s own doc comment has the full before-
 * coding check). `reportKey`'s seven options are the same seven
 * `ReportGenerationProcessor` actually knows how to render (confirmed
 * directly against `TriggerReportGenerationDto`'s own `@IsIn` list, not
 * assumed from the report names alone) — this is a strict subset of
 * `ReportingController`'s full 31 endpoints, not every report this app
 * can generate, only the ones this specific background job supports.
 *
 * Submitting doesn't return a download link directly — the job runs
 * asynchronously; its result (a storage URL once `COMPLETED`) shows up
 * in the job-run table below once the run finishes, not in this form's
 * own success message. See `page.tsx`'s own doc comment for how that
 * result is surfaced.
 */
export function TriggerReportGenerationForm() {
  const [reportKey, setReportKey] = React.useState('budget-vs-actual');
  const [entityId, setEntityId] = React.useState('');
  const [fiscalYear, setFiscalYear] = React.useState('');
  const [format, setFormat] = React.useState('csv');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await triggerReportGeneration({
      reportKey,
      entityId,
      fiscalYear: fiscalYear ? Number(fiscalYear) : undefined,
      format,
    });

    setPending(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to queue report generation.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: tokens.space(2),
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <Select label="Report" value={reportKey} onChange={(e) => setReportKey(e.target.value)} options={REPORT_KEY_OPTIONS} style={{ minWidth: '220px' }} />
      <TextField label="Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField label="Fiscal year (optional)" type="number" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} style={{ minWidth: '140px' }} />
      <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value)} options={FORMAT_OPTIONS} style={{ minWidth: '120px' }} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Queuing…' : 'Generate report'}
      </Button>
      {success && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.positive }}>Queued — check the table below once it completes.</span>}
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
