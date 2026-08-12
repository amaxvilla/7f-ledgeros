'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { addTitleDeed } from './actions';

const TITLE_TYPE_OPTIONS = [
  { value: 'CERTIFICATE_OF_OCCUPANCY', label: 'Certificate of Occupancy' },
  { value: 'DEED_OF_ASSIGNMENT', label: 'Deed of Assignment' },
  { value: 'GOVERNORS_CONSENT', label: "Governor's Consent" },
  { value: 'GAZETTE', label: 'Gazette' },
  { value: 'FREEHOLD', label: 'Freehold' },
  { value: 'LEASEHOLD', label: 'Leasehold' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Frontend Completion, FE-4.2 — `titleType` is a real `Select` (a
 * genuine seven-value enum, `TitleType`, confirmed directly against
 * `schema.prisma`), the same "enum on the DTO gets a Select, not a
 * TextField" convention `Select`'s own doc comment established.
 * `titleNumber`/`issuingAuthority`/`applicationDate`/`documentRef`/
 * `notes` are all plain optional strings on `AddTitleDeedDto`
 * (confirmed directly) — `applicationDate` gets a native `type="date"`
 * `TextField`, the same established convention every other optional
 * date field in this app already uses.
 */
export function AddTitleDeedForm({ parcelId }: { parcelId: string }) {
  const [titleType, setTitleType] = React.useState('');
  const [titleNumber, setTitleNumber] = React.useState('');
  const [issuingAuthority, setIssuingAuthority] = React.useState('');
  const [applicationDate, setApplicationDate] = React.useState('');
  const [documentRef, setDocumentRef] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await addTitleDeed({
      parcelId,
      titleType,
      titleNumber: titleNumber || undefined,
      issuingAuthority: issuingAuthority || undefined,
      applicationDate: applicationDate || undefined,
      documentRef: documentRef || undefined,
      notes: notes || undefined,
    });

    setPending(false);
    if (result.ok) {
      setTitleType('');
      setTitleNumber('');
      setIssuingAuthority('');
      setApplicationDate('');
      setDocumentRef('');
      setNotes('');
    } else {
      setError(result.error ?? 'Failed to add title deed.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Title type"
        value={titleType}
        onChange={(e) => setTitleType(e.target.value)}
        options={TITLE_TYPE_OPTIONS}
        placeholder="Select a title type…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Title number (optional)" value={titleNumber} onChange={(e) => setTitleNumber(e.target.value)} style={{ minWidth: '160px' }} />
      <TextField
        label="Issuing authority (optional)"
        value={issuingAuthority}
        onChange={(e) => setIssuingAuthority(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Application date (optional)"
        type="date"
        value={applicationDate}
        onChange={(e) => setApplicationDate(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField label="Document reference (optional)" value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: '220px' }} />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add title deed'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
