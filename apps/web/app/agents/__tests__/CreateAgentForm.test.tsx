import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAgentMock = vi.fn();
vi.mock('../actions', () => ({
  createAgent: (...args: unknown[]) => createAgentMock(...args),
}));

import { CreateAgentForm } from '../CreateAgentForm';

beforeEach(() => {
  createAgentMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Code'), 'AG-001');
  await user.type(screen.getByLabelText('Display name'), 'Jane Doe Realty');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Phone'), '+2348012345678');
}

describe('CreateAgentForm', () => {
  it('marks Code/Display name/Email/Phone as required, and defaults type to Individual', () => {
    render(<CreateAgentForm entityId="ent-1" />);

    expect(screen.getByLabelText('Code')).toBeRequired();
    expect(screen.getByLabelText('Display name')).toBeRequired();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Phone')).toBeRequired();
    expect(screen.getByLabelText('Agent type')).toHaveValue('INDIVIDUAL');
    expect(screen.getByLabelText('WHT exempt')).toHaveValue('false');
  });

  it('submits required fields, omitting optional fields as undefined when blank', async () => {
    createAgentMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreateAgentForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create agent' }));

    expect(createAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'ent-1',
        agentType: 'INDIVIDUAL',
        code: 'AG-001',
        displayName: 'Jane Doe Realty',
        email: 'jane@example.com',
        phone: '+2348012345678',
        contactPersonName: undefined,
        licenseNumber: undefined,
        withholdingTaxExempt: false,
      }),
    );
  });

  it('surfaces a server-side error, e.g. a duplicate code', async () => {
    createAgentMock.mockResolvedValue({ ok: false, error: 'Agent code "AG-001" is already in use' });
    const user = userEvent.setup();
    render(<CreateAgentForm entityId="ent-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create agent' }));

    expect(await screen.findByText('Agent code "AG-001" is already in use')).toBeInTheDocument();
  });
});
