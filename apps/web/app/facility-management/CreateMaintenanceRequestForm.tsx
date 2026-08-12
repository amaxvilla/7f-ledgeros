'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createMaintenanceRequest } from './actions';

const CATEGORY_OPTIONS = [
  { value: 'MECHANICAL', label: 'Mechanical' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'AMENITY', label: 'Amenity' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

/**
 * Frontend Completion — sixth data-entry form, following
 * CreateTenantForm (Checkpoint Q), CreateLeadForm, CreateTaxCodeForm,
 * CreateFixedAssetForm, and CreateLeaseForm's pattern exactly (see any
 * of their own doc comments for the shared conventions: manual
 * pending/error useState, 'use client' form + 'use server' action
 * split, reset-on-success).
 *
 * Two Select fields, not one — `category` (required, the same 8-value
 * FACILITY_CATEGORIES `@IsIn` list CreateFacilityDto also uses, kept as
 * a local const here rather than imported since this app has no shared
 * frontend/backend enum package yet — every prior form's option list is
 * similarly hand-copied, not a new gap introduced here) and `priority`
 * (optional — CreateMaintenanceRequestDto defaults it server-side when
 * omitted, same as CreateLeaseForm's own optional rentFrequency).
 *
 * `facilityId` stays a plain, optional TextField (an id from the
 * Facilities registry, not an enum — same reasoning CreateLeaseForm's
 * own tenantId/unitId fields give).
 */
export function CreateMaintenanceRequestForm({ entityId }: { entityId: string }) {
  const [category, setCategory] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [facilityId, setFacilityId] = React.useState('');
  const [targetResolutionDate, setTargetResolutionDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createMaintenanceRequest({
      entityId,
      category,
      description,
      priority: priority || undefined,
      facilityId: facilityId || undefined,
      targetResolutionDate: targetResolutionDate || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create maintenance request.');
      return;
    }
    setCategory('');
    setPriority('');
    setDescription('');
    setFacilityId('');
    setTargetResolutionDate('');
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
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={CATEGORY_OPTIONS}
        placeholder="Select a category…"
        required
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        options={PRIORITY_OPTIONS}
        placeholder="Default (medium)"
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        style={{ minWidth: '260px' }}
      />
      <TextField
        label="Facility ID (optional)"
        value={facilityId}
        onChange={(e) => setFacilityId(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Target resolution (optional)"
        type="date"
        value={targetResolutionDate}
        onChange={(e) => setTargetResolutionDate(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Log request'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
