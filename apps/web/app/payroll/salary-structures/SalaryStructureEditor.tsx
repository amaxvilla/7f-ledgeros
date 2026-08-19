'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { updateSalaryStructure } from './actions';

interface SalaryStructure {
  id: string;
  code: string;
  name: string;
  basicSalary?: number | string | null;
  housingAllowance?: number | string | null;
  transportAllowance?: number | string | null;
  otherAllowances?: number | string | null;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

export function SalaryStructureEditor({
  structure,
}: {
  structure: SalaryStructure;
}) {
  const [code, setCode] = React.useState(structure.code);
  const [name, setName] = React.useState(structure.name);
  const [basicSalary, setBasicSalary] = React.useState(
    numberValue(structure.basicSalary),
  );
  const [housingAllowance, setHousingAllowance] = React.useState(
    numberValue(structure.housingAllowance),
  );
  const [transportAllowance, setTransportAllowance] = React.useState(
    numberValue(structure.transportAllowance),
  );
  const [otherAllowances, setOtherAllowances] = React.useState(
    numberValue(structure.otherAllowances),
  );
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!code.trim() || !name.trim()) {
      setError('Code and name are required.');
      return;
    }

    if (!basicSalary || Number(basicSalary) <= 0) {
      setError('Basic salary must be positive.');
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);

    const result = await updateSalaryStructure({
      id: structure.id,
      code,
      name,
      basicSalary: Number(basicSalary),
      housingAllowance: Number(housingAllowance || 0),
      transportAllowance: Number(transportAllowance || 0),
      otherAllowances: Number(otherAllowances || 0),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage('Salary structure updated.');
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: tokens.space(3),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <TextField
        label="Basic salary"
        type="number"
        value={basicSalary}
        onChange={(e) => setBasicSalary(e.target.value)}
        required
      />

      <TextField
        label="Housing allowance"
        type="number"
        value={housingAllowance}
        onChange={(e) => setHousingAllowance(e.target.value)}
      />

      <TextField
        label="Transport allowance"
        type="number"
        value={transportAllowance}
        onChange={(e) => setTransportAllowance(e.target.value)}
      />

      <TextField
        label="Other allowances"
        type="number"
        value={otherAllowances}
        onChange={(e) => setOtherAllowances(e.target.value)}
      />

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
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
