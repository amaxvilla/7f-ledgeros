'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { issueCertification } from './actions';

export function IssueCertificationForm({
  employeeOptions,
}: {
  employeeOptions: SelectOption[];
}) {
  const [employeeId, setEmployeeId] = React.useState('');
  const [name, setName] = React.useState('');
  const [issuedBy, setIssuedBy] = React.useState('');
  const [issueDate, setIssueDate] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [certificateUrl, setCertificateUrl] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!employeeId || !name.trim() || !issueDate) {
      setError('Employee, certification name, and issue date are required.');
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    const result = await issueCertification({
      employeeId,
      name,
      issuedBy,
      issueDate,
      expiryDate: expiryDate || undefined,
      certificateUrl,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmployeeId('');
    setName('');
    setIssuedBy('');
    setIssueDate('');
    setExpiryDate('');
    setCertificateUrl('');
    setMessage('Certification issued.');
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: tokens.space(3),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.space(8),
      }}
    >
      <Select
        label="Employee"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        options={employeeOptions}
        placeholder="Select employee"
      />

      <TextField
        label="Certification name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <TextField
        label="Issued by (optional)"
        value={issuedBy}
        onChange={(e) => setIssuedBy(e.target.value)}
      />

      <TextField
        label="Issue date"
        type="date"
        value={issueDate}
        onChange={(e) => setIssueDate(e.target.value)}
        required
      />

      <TextField
        label="Expiry date (optional)"
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
      />

      <TextField
        label="Certificate URL (optional)"
        value={certificateUrl}
        onChange={(e) => setCertificateUrl(e.target.value)}
      />

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Issuing…' : 'Issue certification'}
        </Button>
      </div>

      {(message || error) && (
        <div
          style={{
            gridColumn: '1 / -1',
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: error ? tokens.color.negative : tokens.color.positive,
          }}
        >
          {error ?? message}
        </div>
      )}
    </form>
  );
}
