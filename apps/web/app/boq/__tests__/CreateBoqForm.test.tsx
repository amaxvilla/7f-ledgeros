import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createBoqMock = vi.fn();
vi.mock('../actions', () => ({
  createBoq: (...args: unknown[]) => createBoqMock(...args),
}));

import { CreateBoqForm } from '../CreateBoqForm';

const PROJECT_OPTIONS = [
  { value: 'proj-1', label: 'PRJ-001 — Riverside Towers' },
  { value: 'proj-2', label: 'PRJ-002 — Harbor View Estate' },
];

beforeEach(() => {
  createBoqMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>, project = 'proj-1') {
  await user.selectOptions(screen.getByLabelText('Project'), project);
  await user.type(screen.getByLabelText('Title'), 'Main contract works');
}

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  itemCode: string,
  description: string,
  unit: string,
  quantity: string,
  rate: string,
) {
  await user.type(screen.getByLabelText(`Item code (line ${index})`), itemCode);
  await user.type(screen.getByLabelText(`Description (line ${index})`), description);
  await user.type(screen.getByLabelText(`Unit (line ${index})`), unit);
  await user.type(screen.getByLabelText(`Quantity (line ${index})`), quantity);
  await user.type(screen.getByLabelText(`Rate (line ${index})`), rate);
}

describe('CreateBoqForm', () => {
  it('renders every header field and a single line by default', () => {
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Contractor ID (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Item code (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (line 1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Rate (line 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Item code (line 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create BOQ' })).toBeInTheDocument();
  });

  it('lists the supplied project options', () => {
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    const select = screen.getByLabelText('Project') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('proj-1');
    expect(values).toContain('proj-2');
  });

  it('adds and removes lines, disabling Remove when only one line remains', async () => {
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    expect(screen.getByLabelText('Item code (line 2)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).not.toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.queryByLabelText('Item code (line 2)')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();
  });

  it('submits a single-line BOQ with the correct payload shape', async () => {
    createBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(createBoqMock).toHaveBeenCalledWith({
      projectId: 'proj-1',
      contractorId: undefined,
      title: 'Main contract works',
      lines: [{ itemCode: 'BOQ-001', description: 'Excavation', unit: 'm3', quantity: 120, rate: 45.5 }],
    });
  });

  it('submits a multi-line BOQ with numeric quantity/rate conversion', async () => {
    createBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user, 'proj-2');
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, 'BOQ-002', 'Formwork', 'm2', '80', '22');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(createBoqMock).toHaveBeenCalledWith({
      projectId: 'proj-2',
      contractorId: undefined,
      title: 'Main contract works',
      lines: [
        { itemCode: 'BOQ-001', description: 'Excavation', unit: 'm3', quantity: 120, rate: 45.5 },
        { itemCode: 'BOQ-002', description: 'Formwork', unit: 'm2', quantity: 80, rate: 22 },
      ],
    });
  });

  it('sends contractorId when provided', async () => {
    createBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Contractor ID (optional)'), 'contractor-7');
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(createBoqMock).toHaveBeenCalledWith(
      expect.objectContaining({ contractorId: 'contractor-7' }),
    );
  });

  it('shows the action-returned error message on failure', async () => {
    createBoqMock.mockResolvedValue({ ok: false, error: 'BOQ needs at least one line' });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(await screen.findByText('BOQ needs at least one line')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    createBoqMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(await screen.findByText('Failed to create BOQ.')).toBeInTheDocument();
  });

  it('resets the form, collapsing back to one blank line, after a successful submit', async () => {
    createBoqMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await fillLine(user, 2, 'BOQ-002', 'Formwork', 'm2', '80', '22');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(await screen.findByLabelText('Item code (line 1)')).toHaveValue('');
    expect(screen.queryByLabelText('Item code (line 2)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Project')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    createBoqMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CreateBoqForm entityId="ent-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await fillLine(user, 1, 'BOQ-001', 'Excavation', 'm3', '120', '45.5');
    await user.click(screen.getByRole('button', { name: 'Create BOQ' }));

    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Create BOQ' })).not.toBeDisabled();
  });
});
