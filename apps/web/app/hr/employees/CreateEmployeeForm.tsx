'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createEmployee } from './actions';

export function CreateEmployeeForm({
  entityId,
  departmentOptions,
  salaryStructureOptions,
}: {
  entityId: string;
  departmentOptions: SelectOption[];
  salaryStructureOptions: SelectOption[];
}) {
  const [employeeCode, setEmployeeCode] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [salaryStructureId, setSalaryStructureId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createEmployee({
      entityId,
      employeeCode,
      firstName,
      lastName,
      departmentId: departmentId || undefined,
      salaryStructureId: salaryStructureId || undefined,
    });

    setPending(false);
    if (result.ok) {
      setEmployeeCode('');
      setFirstName('');
      setLastName('');
      setDepartmentId('');
      setSalaryStructureId('');
    } else {
      setError(result.error ?? 'Failed to create employee.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField
        label="Employee code"
        value={employeeCode}
        onChange={(e) => setEmployeeCode(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Last name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Department (optional)"
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        options={departmentOptions}
        placeholder="No department"
        style={{ minWidth: '200px' }}
      />
      <Select
        label="Salary structure (optional)"
        value={salaryStructureId}
        onChange={(e) => setSalaryStructureId(e.target.value)}
        options={salaryStructureOptions}
        placeholder="No salary structure"
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Add employee'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
