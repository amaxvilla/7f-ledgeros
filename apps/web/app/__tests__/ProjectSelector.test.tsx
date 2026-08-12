import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectSelector } from '../ProjectSelector';

const PROJECT_OPTIONS = [
  { id: 'proj-1', code: 'PRJ-001', name: 'Riverside Towers' },
  { id: 'proj-2', code: 'PRJ-002', name: 'Harbor View' },
];

describe('ProjectSelector', () => {
  it('associates the "Project" label with its select', () => {
    render(<ProjectSelector entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);
    expect(screen.getByLabelText('Project')).toBeInTheDocument();
  });

  it('lists a placeholder plus every project option, coded and named', () => {
    render(<ProjectSelector entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);
    expect(screen.getByRole('option', { name: 'Select a project…' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PRJ-001 — Riverside Towers' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PRJ-002 — Harbor View' })).toBeInTheDocument();
  });

  it('carries the current entityId forward as a hidden field', () => {
    const { container } = render(<ProjectSelector entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);
    const hidden = container.querySelector('input[type="hidden"][name="entityId"]') as HTMLInputElement;
    expect(hidden).toBeInTheDocument();
    expect(hidden.value).toBe('ent-1');
  });

  it('pre-selects the select from initialValue', () => {
    render(<ProjectSelector entityId="ent-1" projectOptions={PROJECT_OPTIONS} initialValue="proj-2" />);
    expect(screen.getByLabelText('Project')).toHaveValue('proj-2');
  });
});
