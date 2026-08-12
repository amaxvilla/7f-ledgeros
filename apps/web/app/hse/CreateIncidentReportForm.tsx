'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createIncidentReport } from './actions';

const SEVERITY_OPTIONS = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'SEVERE', label: 'Severe' },
  { value: 'FATAL', label: 'Fatal' },
];

/**
 * Frontend Completion — see `actions.ts`'s own doc comment for the
 * full before-coding analysis. `projectId` is a `Select` fed by the
 * caller-supplied `projectOptions` prop, the same `GET /dimensions/
 * projects?entityId=` fetch `CreateRiskForm`'s own required version
 * already established — NOT `required` here, since
 * `CreateIncidentReportDto.projectId` is itself optional; left blank,
 * `undefined` is sent rather than an empty string, same "optional
 * field omitted, not sent empty" convention `CreateWorkPackageForm`'s
 * own `description` field already established.
 */
export function CreateIncidentReportForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [incidentDate, setIncidentDate] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [severity, setSeverity] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createIncidentReport({
      entityId,
      projectId: projectId || undefined,
      incidentDate,
      location: location || undefined,
      description,
      severity,
    });

    setPending(false);
    if (result.ok) {
      setProjectId('');
      setIncidentDate('');
      setLocation('');
      setDescription('');
      setSeverity('');
    } else {
      setError(result.error ?? 'Failed to create incident report.');
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
        label="Project (optional)"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        options={projectOptions}
        placeholder="No project"
        style={{ minWidth: '200px' }}
      />
      <TextField
        label="Incident date"
        type="date"
        value={incidentDate}
        onChange={(e) => setIncidentDate(e.target.value)}
        required
      />
      <TextField
        label="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        style={{ minWidth: '240px' }}
      />
      <Select
        label="Severity"
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
        options={SEVERITY_OPTIONS}
        placeholder="Select severity…"
        required
        style={{ minWidth: '160px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Reporting…' : 'Report incident'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
