'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { recordAcquisition } from './actions';

/**
 * Frontend Completion, FE-4.1 — `parcelId` is a real `Select` sourced
 * from `parcelOptions`, built by `page.tsx` from the same parcels list
 * its own table renders — see `actions.ts`'s own doc comment. No
 * `revalidatePath`-driven table on THIS component to refresh directly;
 * a successful acquisition shows up in the Land Parcels table's own
 * acquisition count on the next render (the server action already
 * calls `revalidatePath('/land-bank')`), so this form shows an inline
 * success message rather than rendering any data of its own — same
 * reasoning `RecordCustomerPaymentForm`'s own doc comment gives.
 */
export function RecordAcquisitionForm({ parcelOptions }: { parcelOptions: SelectOption[] }) {
  const [parcelId, setParcelId] = React.useState('');
  const [vendorName, setVendorName] = React.useState('');
  const [vendorContact, setVendorContact] = React.useState('');
  const [agreedPrice, setAgreedPrice] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('');
  const [dueDiligenceNotes, setDueDiligenceNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await recordAcquisition({
      parcelId,
      vendorName,
      vendorContact: vendorContact || undefined,
      agreedPrice: Number(agreedPrice),
      currency: currency || undefined,
      paymentTerms: paymentTerms || undefined,
      dueDiligenceNotes: dueDiligenceNotes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to record acquisition.');
      return;
    }
    setParcelId('');
    setVendorName('');
    setVendorContact('');
    setAgreedPrice('');
    setCurrency('');
    setPaymentTerms('');
    setDueDiligenceNotes('');
    setSuccess(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Parcel"
        value={parcelId}
        onChange={(e) => setParcelId(e.target.value)}
        options={parcelOptions}
        placeholder="Select a parcel…"
        required
        style={{ minWidth: '220px' }}
      />
      <TextField label="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField label="Vendor contact (optional)" value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} style={{ minWidth: '180px' }} />
      <TextField label="Agreed price" type="number" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField label="Currency (optional)" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="e.g. NGN" style={{ minWidth: '120px' }} />
      <TextField label="Payment terms (optional)" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={{ minWidth: '200px' }} />
      <TextField
        label="Due diligence notes (optional)"
        value={dueDiligenceNotes}
        onChange={(e) => setDueDiligenceNotes(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record acquisition'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      {success && (
        <div style={{ width: '100%', color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Acquisition recorded against the selected parcel.
        </div>
      )}
    </form>
  );
}
