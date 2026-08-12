import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const endAssignmentMock = vi.fn();
vi.mock('../actions', () => ({
  endAssignment: (...args: unknown[]) => endAssignmentMock(...args),
}));

import { EndAssignmentButton } from '../EndAssignmentButton';

beforeEach(() => {
  endAssignmentMock.mockReset();
});

describe('EndAssignmentButton', () => {
  it('renders "Ended" with no control when the assignment is already inactive', () => {
    render(<EndAssignmentButton id="assign-1" isActive={false} />);

    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End' })).not.toBeInTheDocument();
  });

  it('blocks ending without a reason', async () => {
    const user = userEvent.setup();
    render(<EndAssignmentButton id="assign-1" isActive={true} />);

    await user.click(screen.getByRole('button', { name: 'End' }));

    expect(screen.getByText('Enter a reason.')).toBeInTheDocument();
    expect(endAssignmentMock).not.toHaveBeenCalled();
  });

  it('calls endAssignment with the id and trimmed reason', async () => {
    endAssignmentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EndAssignmentButton id="assign-1" isActive={true} />);

    await user.type(screen.getByLabelText('Reason'), '  Agent reassigned  ');
    await user.click(screen.getByRole('button', { name: 'End' }));

    expect(endAssignmentMock).toHaveBeenCalledWith('assign-1', 'Agent reassigned');
  });

  it('surfaces a server-side error, e.g. already-ended', async () => {
    endAssignmentMock.mockResolvedValue({ ok: false, error: 'Agent assignment assign-1 has already ended' });
    const user = userEvent.setup();
    render(<EndAssignmentButton id="assign-1" isActive={true} />);

    await user.type(screen.getByLabelText('Reason'), 'duplicate click');
    await user.click(screen.getByRole('button', { name: 'End' }));

    expect(await screen.findByText('Agent assignment assign-1 has already ended')).toBeInTheDocument();
  });
});
