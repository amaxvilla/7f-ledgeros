import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const linkMonoAccountMock = vi.fn();
vi.mock('../actions', () => ({
  linkMonoAccount: (...args: unknown[]) => linkMonoAccountMock(...args),
}));

import { LinkMonoAccountForm } from '../LinkMonoAccountForm';

const BANK_ACCOUNTS = [
  { id: 'ba-1', accountName: 'Operating Account', bankName: 'Zenith Bank' },
  { id: 'ba-2', accountName: 'Payroll Account', bankName: 'GTBank' },
];

beforeEach(() => {
  linkMonoAccountMock.mockReset();
});

describe('LinkMonoAccountForm', () => {
  it('renders every field with its label', () => {
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    expect(screen.getByLabelText('Bank account')).toBeInTheDocument();
    expect(screen.getByLabelText('Mono Connect code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link account' })).toBeInTheDocument();
  });

  it('lists each bank account by name and bank as a Bank account option', () => {
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    expect(screen.getByRole('option', { name: 'Operating Account (Zenith Bank)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Payroll Account (GTBank)' })).toBeInTheDocument();
  });

  it('marks both fields as required', () => {
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    expect(screen.getByLabelText('Bank account')).toBeRequired();
    expect(screen.getByLabelText('Mono Connect code')).toBeRequired();
  });

  it('submits with the selected bankAccountId and entered code', async () => {
    linkMonoAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    await user.selectOptions(screen.getByLabelText('Bank account'), 'ba-2');
    await user.type(screen.getByLabelText('Mono Connect code'), 'consent-abc');
    await user.click(screen.getByRole('button', { name: 'Link account' }));

    expect(linkMonoAccountMock).toHaveBeenCalledWith({ bankAccountId: 'ba-2', code: 'consent-abc' });
  });

  it('shows the action-returned error message on failure', async () => {
    linkMonoAccountMock.mockResolvedValue({ ok: false, error: 'This Mono account is already linked to a bank account' });
    const user = userEvent.setup();
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    await user.selectOptions(screen.getByLabelText('Bank account'), 'ba-1');
    await user.type(screen.getByLabelText('Mono Connect code'), 'consent-abc');
    await user.click(screen.getByRole('button', { name: 'Link account' }));

    expect(await screen.findByText('This Mono account is already linked to a bank account')).toBeInTheDocument();
  });

  it('resets both fields after a successful submit', async () => {
    linkMonoAccountMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    await user.selectOptions(screen.getByLabelText('Bank account'), 'ba-1');
    await user.type(screen.getByLabelText('Mono Connect code'), 'consent-abc');
    await user.click(screen.getByRole('button', { name: 'Link account' }));

    expect(await screen.findByLabelText('Bank account')).toHaveValue('');
    expect(screen.getByLabelText('Mono Connect code')).toHaveValue('');
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    linkMonoAccountMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<LinkMonoAccountForm bankAccounts={BANK_ACCOUNTS} />);

    await user.selectOptions(screen.getByLabelText('Bank account'), 'ba-1');
    await user.type(screen.getByLabelText('Mono Connect code'), 'consent-abc');
    await user.click(screen.getByRole('button', { name: 'Link account' }));

    const pendingButton = screen.getByRole('button', { name: 'Linking…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Link account' })).not.toBeDisabled();
  });

  it('renders the empty-state message when there are no bank accounts, leaving the field genuinely unselectable', () => {
    render(<LinkMonoAccountForm bankAccounts={[]} />);

    // Select's own empty-options branch (packages/ui/src/components/Form.tsx,
    // FE-10.2) replaces the interactive <select> entirely with a plain,
    // non-interactive <div> — this form passes no `emptyMessage` of its own,
    // so Select's own default ("No options available.") is what actually
    // renders, not the `placeholder` text ("Select a bank account…"), which
    // only ever appears inside the real <select> branch. Both parts of this
    // test's prior assertion were a pre-existing, real test/behavior
    // mismatch, fixed in FE-10.8, unrelated to this checkpoint's own change
    // to the form.
    expect(screen.getByText('No options available.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Bank account' })).not.toBeInTheDocument();
  });
});
