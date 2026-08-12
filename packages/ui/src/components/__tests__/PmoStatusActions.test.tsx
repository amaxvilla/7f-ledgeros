import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PmoStatusActions } from '../PmoStatusActions';

const onAdvanceMock = vi.fn();

beforeEach(() => {
  onAdvanceMock.mockReset();
});

describe('PmoStatusActions — workflow progression', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT document', () => {
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED document', () => {
    render(<PmoStatusActions status="REVIEWED" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED document', () => {
    render(<PmoStatusActions status="APPROVED" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows just a dash for an already-CERTIFIED document', () => {
    render(<PmoStatusActions status="CERTIFIED" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows just a dash for a REJECTED document (not a member of WORKFLOW_ORDER)', () => {
    render(<PmoStatusActions status="REJECTED" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows just a dash for a status outside WORKFLOW_ORDER entirely', () => {
    render(<PmoStatusActions status="SOME_UNKNOWN_STATUS" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PmoStatusActions — calling onAdvance', () => {
  it('calls onAdvance with the next status and "advance" when the advance button is clicked', async () => {
    onAdvanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(onAdvanceMock).toHaveBeenCalledWith('REVIEWED', 'advance');
  });

  it('calls onAdvance with REJECTED and "reject" when the reject button is clicked', async () => {
    onAdvanceMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onAdvanceMock).toHaveBeenCalledWith('REJECTED', 'reject');
  });

  it('shows "Advancing…" on the button while its own call is in flight, not "Rejecting…"', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    onAdvanceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });
});

describe('PmoStatusActions — error handling', () => {
  it('shows the returned error message on failure', async () => {
    onAdvanceMock.mockResolvedValue({ ok: false, error: 'Cannot advance from this status.' });
    const user = userEvent.setup();
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot advance from this status.')).toBeInTheDocument();
  });

  it('falls back to errorFallback when the action fails with no message', async () => {
    onAdvanceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed to update BOQ status." />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Failed to update BOQ status.')).toBeInTheDocument();
  });
});

describe('PmoStatusActions — buttonFontSize', () => {
  it('defaults to 12px when not provided', () => {
    render(<PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." />);
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toHaveStyle({ fontSize: '12px' });
  });

  it('uses the provided buttonFontSize, including on the terminal dash', () => {
    const { rerender } = render(
      <PmoStatusActions status="DRAFT" onAdvance={onAdvanceMock} errorFallback="Failed." buttonFontSize="11px" />,
    );
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toHaveStyle({ fontSize: '11px' });

    rerender(<PmoStatusActions status="CERTIFIED" onAdvance={onAdvanceMock} errorFallback="Failed." buttonFontSize="11px" />);
    expect(screen.getByText('—')).toHaveStyle({ fontSize: '11px' });
  });
});
