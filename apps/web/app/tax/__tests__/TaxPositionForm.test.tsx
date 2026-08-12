import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaxPositionForm } from '../TaxPositionForm';

describe('TaxPositionForm', () => {
  it('submits as a native GET form to /tax, not a Server Action — no fetch/action mock needed here', () => {
    render(<TaxPositionForm entityId="ent-1" />);

    const form = screen.getByRole('button', { name: 'View tax position' }).closest('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/tax');
  });

  it('carries entityId as a hidden input so it round-trips through the GET submit', () => {
    const { container } = render(<TaxPositionForm entityId="ent-42" />);

    const hidden = container.querySelector('input[name="entityId"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.type).toBe('hidden');
    expect(hidden.value).toBe('ent-42');
  });

  it('names the date fields periodStart/periodEnd so they appear as query params on submit', () => {
    const { container } = render(<TaxPositionForm entityId="ent-1" />);

    expect(container.querySelector('input[name="periodStart"]')).not.toBeNull();
    expect(container.querySelector('input[name="periodEnd"]')).not.toBeNull();
  });

  it('defaults period start/end from props when provided', () => {
    render(<TaxPositionForm entityId="ent-1" periodStart="2026-01-01" periodEnd="2026-03-31" />);

    expect(screen.getByLabelText('Period start')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Period end')).toHaveValue('2026-03-31');
  });

  it('defaults to empty when no period props are given', () => {
    render(<TaxPositionForm entityId="ent-1" />);

    expect(screen.getByLabelText('Period start')).toHaveValue('');
    expect(screen.getByLabelText('Period end')).toHaveValue('');
  });

  it('marks both date fields required', () => {
    render(<TaxPositionForm entityId="ent-1" />);

    expect(screen.getByLabelText('Period start')).toBeRequired();
    expect(screen.getByLabelText('Period end')).toBeRequired();
  });

  it('updates the controlled value as the user types', async () => {
    const user = userEvent.setup();
    render(<TaxPositionForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Period start'), '2026-06-01');
    expect(screen.getByLabelText('Period start')).toHaveValue('2026-06-01');
  });
});
