'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import { createMasterPlan } from './actions';

interface ZoneLine {
  code: string;
  name: string;
  useType: string;
  plannedAreaSqm: string;
  plannedUnitCount: string;
}

const EMPTY_ZONE: ZoneLine = { code: '', name: '', useType: '', plannedAreaSqm: '', plannedUnitCount: '' };

const USE_TYPE_OPTIONS = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXED_USE', label: 'Mixed use' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'AGRICULTURAL', label: 'Agricultural' },
];

/**
 * Frontend Completion, FE-4.7 — reuses `SubdividePlotsForm`'s own
 * dynamic add/remove-line pattern for `zones`, with one real
 * difference: `zones` is genuinely OPTIONAL on `CreateMasterPlanDto`
 * (confirmed directly — `@IsOptional()`, no `@ArrayMinSize`), unlike
 * `subdivideParcel`'s `plots`, which throws on an empty array. So this
 * form starts with ZERO zone rows (not one), "+ Add zone" is the only
 * way to add the form's first row, and "Remove" has no
 * `disabled={zones.length === 1}` floor — removing every row is a
 * valid, submittable state (a master plan with a `summary` but no
 * zones yet).
 *
 * `useType` is a real `Select` (`PlotUseType`, the same 5 values
 * `SubdividePlotsForm`'s own options list already uses) — required per
 * zone once a row exists, since `MasterPlanZoneDto.useType` has no
 * server-side default the way `Plot.useType` does.
 *
 * ADDENDUM (FE-10.31, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add zone),
 * same fix `SubdividePlotsForm`'s own sibling ADDENDUM in this same
 * batch just applied. Verified directly against this file's own
 * current source before fixing.
 */
export function CreateMasterPlanForm({ estateId }: { estateId: string }) {
  const [summary, setSummary] = React.useState('');
  const [totalPlannedUnits, setTotalPlannedUnits] = React.useState('');
  const [zones, setZones] = React.useState<ZoneLine[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateZone(index: number, field: keyof ZoneLine, value: string) {
    setZones((prev) => prev.map((zone, i) => (i === index ? { ...zone, [field]: value } : zone)));
  }

  function addZone() {
    setZones((prev) => [...prev, { ...EMPTY_ZONE }]);
  }

  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createMasterPlan({
      estateId,
      summary: summary || undefined,
      totalPlannedUnits: totalPlannedUnits ? Number(totalPlannedUnits) : undefined,
      zones:
        zones.length > 0
          ? zones.map((zone) => ({
              code: zone.code,
              name: zone.name,
              useType: zone.useType,
              plannedAreaSqm: zone.plannedAreaSqm ? Number(zone.plannedAreaSqm) : undefined,
              plannedUnitCount: zone.plannedUnitCount ? Number(zone.plannedUnitCount) : undefined,
            }))
          : undefined,
    });

    setPending(false);
    if (result.ok) {
      setSummary('');
      setTotalPlannedUnits('');
      setZones([]);
    } else {
      setError(result.error ?? 'Failed to create master plan.');
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
        <TextField
          label="Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          style={{ minWidth: '260px' }}
        />
        <TextField
          label="Total planned units"
          type="number"
          value={totalPlannedUnits}
          onChange={(e) => setTotalPlannedUnits(e.target.value)}
          style={{ minWidth: '160px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Zones (optional)
        </span>
        {zones.map((zone, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Code (zone ${index + 1})`}
              value={zone.code}
              onChange={(e) => updateZone(index, 'code', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <TextField
              label={`Name (zone ${index + 1})`}
              value={zone.name}
              onChange={(e) => updateZone(index, 'name', e.target.value)}
              required
              style={{ minWidth: '160px' }}
            />
            <Select
              label={`Use type (zone ${index + 1})`}
              value={zone.useType}
              onChange={(e) => updateZone(index, 'useType', e.target.value)}
              options={USE_TYPE_OPTIONS}
              placeholder="Select a use type…"
              required
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Planned area sqm (zone ${index + 1})`}
              type="number"
              value={zone.plannedAreaSqm}
              onChange={(e) => updateZone(index, 'plannedAreaSqm', e.target.value)}
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Planned unit count (zone ${index + 1})`}
              type="number"
              value={zone.plannedUnitCount}
              onChange={(e) => updateZone(index, 'plannedUnitCount', e.target.value)}
              style={{ minWidth: '160px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeZone(index)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addZone}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add zone
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create master plan'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
