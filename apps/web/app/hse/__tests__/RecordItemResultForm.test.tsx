import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordItemResultMock = vi.fn();
vi.mock('../actions', () => ({
  recordItemResult: (...args: unknown[]) => recordItemResultMock(...args),
}));

import { RecordItemResultForm } from '../RecordItemResultForm';

beforeEach(() => {
  recordItemResultMock.mockReset();
});

describe('RecordItemResultForm', () => {
  it('renders an assessment form for an unassessed item', () => {
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    expect(screen.getByText('Guardrails secure')).toBeInTheDocument();
    expect(screen.getByLabelText('Result')).toBeInTheDocument();
    expect(screen.getByLabelText('Remarks (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders a static Compliant summary once already assessed, with no form', () => {
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={true} remarks="All good" />);

    expect(screen.getByText(/Guardrails secure/)).toBeInTheDocument();
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('renders a static Non-compliant summary once already assessed as non-compliant', () => {
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={false} remarks={null} />);

    expect(screen.getByText('Non-compliant')).toBeInTheDocument();
  });

  it('submits isCompliant true and remarks when Compliant is chosen', async () => {
    recordItemResultMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    await user.selectOptions(screen.getByLabelText('Result'), 'compliant');
    await user.type(screen.getByLabelText('Remarks (optional)'), 'Checked twice');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(recordItemResultMock).toHaveBeenCalledWith('item-1', true, 'Checked twice');
  });

  it('submits isCompliant false and omits remarks when left blank', async () => {
    recordItemResultMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    await user.selectOptions(screen.getByLabelText('Result'), 'non-compliant');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(recordItemResultMock).toHaveBeenCalledWith('item-1', false, undefined);
  });

  it('shows the action-returned error message on failure', async () => {
    recordItemResultMock.mockResolvedValue({ ok: false, error: 'Checklist item item-1 not found' });
    const user = userEvent.setup();
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    await user.selectOptions(screen.getByLabelText('Result'), 'compliant');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Checklist item item-1 not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    recordItemResultMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    await user.selectOptions(screen.getByLabelText('Result'), 'compliant');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to record item result.')).toBeInTheDocument();
  });

  it('disables the button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    recordItemResultMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<RecordItemResultForm itemId="item-1" itemDescription="Guardrails secure" isCompliant={null} remarks={null} />);

    await user.selectOptions(screen.getByLabelText('Result'), 'compliant');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolveAction({ ok: true });
  });
});
