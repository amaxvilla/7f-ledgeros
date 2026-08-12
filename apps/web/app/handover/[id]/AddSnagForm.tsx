'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { addSnag } from '../actions';

const SEVERITY_OPTIONS = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
];

/**
 * Frontend Completion, FE-4.1. `AddSnagDto`'s own `source` field is
 * deliberately NOT on this form — confirmed directly it defaults to
 * `HANDOVER_INSPECTION` server-side (`SnagSource`, `HandoverService.addSnag`),
 * and the other value, `POST_HANDOVER_REPORT`, describes a snag reported
 * through a different channel entirely (a customer's own post-handover
 * complaint, not one logged here during/after an inspection) — exposing
 * it as a field on this form would let someone silently mislabel where
 * a snag actually came from, not add real value.
 *
 * `assignedToId` is a plain, optional `TextField` — same "opaque ID, no
 * registry" shape every other unresolved-user-picker field in this app
 * already has (e.g. `CreateWorkPackageForm`'s `contractorId`); no
 * `GET /users` list endpoint was found to build a `Select` from.
 */
export function AddSnagForm({ handoverRecordId }: { handoverRecordId: string }) {
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [severity, setSeverity] = React.useState('MINOR');
  const [assignedToId, setAssignedToId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await addSnag(handoverRecordId, {
      description,
      category: category || undefined,
      severity,
      assignedToId: assignedToId || undefined,
      dueDate: dueDate || undefined,
    });

    setPending(false);
    if (result.ok) {
      setDescription('');
      setCategory('');
      setSeverity('MINOR');
      setAssignedToId('');
      setDueDate('');
    } else {
      setError(result.error ?? 'Failed to add snag.');
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
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ minWidth: '260px' }} />
      <TextField label="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ minWidth: '160px' }} />
      <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} options={SEVERITY_OPTIONS} style={{ minWidth: '140px' }} />
      <TextField label="Assigned to (user ID, optional)" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} style={{ minWidth: '200px' }} />
      <TextField label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ minWidth: '160px' }} />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add snag'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
