'use client';

import * as React from 'react';
import { Badge, Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import {
  approvePayrollRun,
  calculatePayrollRun,
  postPayrollRun,
} from './actions';

type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED';

export function PayrollRunActions({
  id,
  entityId,
  initialStatus,
  initialJournalEntryId,
  accountOptions,
}: {
  id: string;
  entityId: string;
  initialStatus: PayrollStatus;
  initialJournalEntryId: string | null;
  accountOptions: SelectOption[];
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [journalEntryId, setJournalEntryId] = React.useState(
    initialJournalEntryId,
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [entryDate, setEntryDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [salaryExpenseGlId, setSalaryExpenseGlId] = React.useState('');
  const [employerPensionExpenseGlId, setEmployerPensionExpenseGlId] =
    React.useState('');
  const [payePayableGlId, setPayePayableGlId] = React.useState('');
  const [pensionPayableGlId, setPensionPayableGlId] = React.useState('');
  const [nhfPayableGlId, setNhfPayableGlId] = React.useState('');
  const [netSalariesPayableGlId, setNetSalariesPayableGlId] =
    React.useState('');
  const [otherDeductionsPayableGlId, setOtherDeductionsPayableGlId] =
    React.useState('');

  async function runCalculate() {
    setPending(true);
    setError(null);
    setMessage(null);

    const result = await calculatePayrollRun(id);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus('CALCULATED');
    setMessage('Payroll calculated successfully.');
  }

  async function runApprove() {
    setPending(true);
    setError(null);
    setMessage(null);

    const result = await approvePayrollRun(id);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus('APPROVED');
    setMessage('Payroll run approved.');
  }

  async function runPost(event: React.FormEvent) {
    event.preventDefault();

    const required = [
      salaryExpenseGlId,
      employerPensionExpenseGlId,
      payePayableGlId,
      pensionPayableGlId,
      nhfPayableGlId,
      netSalariesPayableGlId,
    ];

    if (required.some((value) => !value) || !entryDate) {
      setError(
        'Entry date and all six required payroll GL accounts must be selected.',
      );
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    const result = await postPayrollRun({
      payrollRunId: id,
      entityId,
      entryDate,
      salaryExpenseGlId,
      employerPensionExpenseGlId,
      payePayableGlId,
      pensionPayableGlId,
      nhfPayableGlId,
      netSalariesPayableGlId,
      otherDeductionsPayableGlId:
        otherDeductionsPayableGlId || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus('POSTED');
    setMessage('Payroll posted to the general ledger.');

    if (
      result.ok &&
      result.data &&
      typeof result.data === 'object' &&
      'journalEntry' in result.data &&
      result.data.journalEntry &&
      typeof result.data.journalEntry === 'object' &&
      'id' in result.data.journalEntry &&
      typeof result.data.journalEntry.id === 'string'
    ) {
      setJournalEntryId(result.data.journalEntry.id);
    }
  }

  const tone =
    status === 'POSTED'
      ? 'positive'
      : status === 'APPROVED'
        ? 'positive'
        : status === 'CALCULATED'
          ? 'warning'
          : 'neutral';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(2),
        minWidth: '280px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: tokens.space(2),
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Badge tone={tone}>{status}</Badge>

        {status === 'DRAFT' && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={runCalculate}
          >
            {pending ? 'Calculating…' : 'Calculate'}
          </Button>
        )}

        {status === 'CALCULATED' && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={runApprove}
          >
            {pending ? 'Approving…' : 'Approve'}
          </Button>
        )}
      </div>

      {status === 'APPROVED' && (
        <form
          onSubmit={runPost}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: tokens.space(2),
            padding: tokens.space(3),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
          }}
        >
          <TextField
            label="Entry date"
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />

          <Select
            label="Salary expense GL"
            value={salaryExpenseGlId}
            onChange={(event) => setSalaryExpenseGlId(event.target.value)}
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="Employer pension expense GL"
            value={employerPensionExpenseGlId}
            onChange={(event) =>
              setEmployerPensionExpenseGlId(event.target.value)
            }
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="PAYE payable GL"
            value={payePayableGlId}
            onChange={(event) => setPayePayableGlId(event.target.value)}
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="Pension payable GL"
            value={pensionPayableGlId}
            onChange={(event) =>
              setPensionPayableGlId(event.target.value)
            }
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="NHF payable GL"
            value={nhfPayableGlId}
            onChange={(event) => setNhfPayableGlId(event.target.value)}
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="Net salaries payable GL"
            value={netSalariesPayableGlId}
            onChange={(event) =>
              setNetSalariesPayableGlId(event.target.value)
            }
            options={accountOptions}
            placeholder="Select account"
          />

          <Select
            label="Other deductions payable GL"
            value={otherDeductionsPayableGlId}
            onChange={(event) =>
              setOtherDeductionsPayableGlId(event.target.value)
            }
            options={accountOptions}
            placeholder="Optional"
          />

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button type="submit" disabled={pending}>
              {pending ? 'Posting…' : 'Post to GL'}
            </Button>
          </div>
        </form>
      )}

      {status === 'POSTED' && (
        <span
          style={{
            color: tokens.color.positive,
            fontFamily: tokens.font.body,
            fontSize: '12px',
          }}
        >
          Posted{journalEntryId ? ` · Journal ${journalEntryId}` : '.'}
        </span>
      )}

      {message && (
        <span
          style={{
            color: tokens.color.positive,
            fontFamily: tokens.font.body,
            fontSize: '12px',
          }}
        >
          {message}
        </span>
      )}

      {error && (
        <span
          style={{
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            fontSize: '12px',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
