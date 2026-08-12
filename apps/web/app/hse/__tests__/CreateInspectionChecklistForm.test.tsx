import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createInspectionChecklistMock = vi.fn();
vi.mock('../actions', () => ({
  createInspectionChecklist: (...args: unknown[]) => createInspectionChecklistMock(...args),
}));

import { CreateInspectionChecklistForm } from '../CreateInspectionChecklistForm';

const PROJECT_OPTIONS = [{ value: 'proj-1', label: 'PRJ-001 — Riverside Tower' }];

beforeEach(() => {
  createInspectionChecklistMock.mockReset();
});

async function fillHeaderFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Checklist type'), 'Scaffolding');
  await user.type(screen.getByLabelText('Inspection date'), '2026-08-01');
  await user.type(screen.getByLabelText('Inspector'), 'Site Inspector A');
}

describe('CreateInspectionChecklistForm', () => {
  it('renders the header fields and one item by default', () => {
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    expect(screen.getByLabelText('Project (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Checklist type')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspection date')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspector')).toBeInTheDocument();
    expect(screen.getByLabelText('Item description (item 1)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Item description (item 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create checklist' })).toBeInTheDocument();
  });

  it('adds a second item when "+ Add item" is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add item' }));

    expect(screen.getByLabelText('Item description (item 2)')).toBeInTheDocument();
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).not.toBeDisabled();
  });

  it('removes an item and re-disables Remove once back to one item', async () => {
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);

    expect(screen.queryByLabelText('Item description (item 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('submits entityId (from props, not a field), header fields, and items', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    expect(createInspectionChecklistMock).toHaveBeenCalledWith({
      entityId: 'entity-1',
      projectId: undefined,
      checklistType: 'Scaffolding',
      inspectionDate: '2026-08-01',
      inspectorId: 'Site Inspector A',
      items: [{ itemDescription: 'Guardrails secure' }],
    });
  });

  it('submits multiple items in order', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    await user.type(screen.getByLabelText('Item description (item 2)'), 'Base plates level');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    const call = createInspectionChecklistMock.mock.calls[0][0];
    expect(call.items).toEqual([
      { itemDescription: 'Guardrails secure' },
      { itemDescription: 'Base plates level' },
    ]);
  });

  it('includes projectId when selected', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText('Project (optional)'), 'proj-1');
    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    const call = createInspectionChecklistMock.mock.calls[0][0];
    expect(call.projectId).toBe('proj-1');
  });

  it('clears the form on success, back to a single empty item', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    expect(screen.getByLabelText('Checklist type')).toHaveValue('');
    expect(screen.getByLabelText('Item description (item 1)')).toHaveValue('');
    expect(screen.queryByLabelText('Item description (item 2)')).not.toBeInTheDocument();
  });

  it('shows the server error and keeps field values on failure', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: false, error: 'Checklist needs at least one item' });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    expect(await screen.findByText('Checklist needs at least one item')).toBeInTheDocument();
    expect(screen.getByLabelText('Checklist type')).toHaveValue('Scaffolding');
  });

  it('shows a generic error message when the failure has none', async () => {
    createInspectionChecklistMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    expect(await screen.findByText('Failed to create inspection checklist.')).toBeInTheDocument();
  });

  it('disables the submit button and shows pending text while submitting', async () => {
    let resolvePromise: (value: { ok: boolean }) => void;
    createInspectionChecklistMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    const user = userEvent.setup();
    render(<CreateInspectionChecklistForm entityId="entity-1" projectOptions={PROJECT_OPTIONS} />);

    await fillHeaderFields(user);
    await user.type(screen.getByLabelText('Item description (item 1)'), 'Guardrails secure');
    await user.click(screen.getByRole('button', { name: 'Create checklist' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    resolvePromise!({ ok: true });
  });
});
