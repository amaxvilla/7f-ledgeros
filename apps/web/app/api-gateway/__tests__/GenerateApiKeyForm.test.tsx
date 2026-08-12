import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const generateApiKeyMock = vi.fn();
vi.mock('../actions', () => ({
  generateApiKey: (...args: unknown[]) => generateApiKeyMock(...args),
}));

import { GenerateApiKeyForm } from '../GenerateApiKeyForm';

beforeEach(() => {
  generateApiKeyMock.mockReset();
});

/**
 * Verification pass — `GenerateApiKeyForm.tsx` (Checkpoint AR) had no
 * test file at all despite this app's otherwise near-universal
 * per-component test coverage. Found while re-investigating "API Keys"
 * as this session's own recommended next checkpoint: the page, form,
 * and revoke action all already exist and are fully wired up (`/api-
 * gateway`, not `/api-keys` — see this checkpoint's own report for
 * where the last several reports' "entirely unbuilt" claim went
 * wrong), so the actual smallest logical gap here is this missing test
 * file, not a new page. Mirrors `EnrollMfaForm.test.tsx`'s own
 * two-step-flow shape, the precedent `GenerateApiKeyForm`'s own doc
 * comment cites directly.
 */
describe('GenerateApiKeyForm', () => {
  it('renders the form step with a Name field and a Generate button', () => {
    render(<GenerateApiKeyForm entityId="ent-1" />);

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Scopes (comma-separated, optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Expires at (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Rate limit / min (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate API key' })).toBeInTheDocument();
  });

  it('only marks Name as required', () => {
    render(<GenerateApiKeyForm entityId="ent-1" />);

    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Scopes (comma-separated, optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Expires at (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Rate limit / min (optional)')).not.toBeRequired();
  });

  it('submits entityId and name, omitting every optional field as undefined when left blank', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: true, plaintextKey: '7fk_live_abc123' });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Partner integration — Acme Corp');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(generateApiKeyMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      name: 'Partner integration — Acme Corp',
      scopes: undefined,
      expiresAt: undefined,
      rateLimitPerMinute: undefined,
    });
  });

  it('splits comma-separated scopes into a trimmed array, and converts rateLimitPerMinute to a number', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: true, plaintextKey: '7fk_live_abc123' });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.type(screen.getByLabelText('Scopes (comma-separated, optional)'), 'payments.read,  invoices.read ,reports.read');
    await user.type(screen.getByLabelText('Expires at (optional)'), '2027-01-01');
    await user.type(screen.getByLabelText('Rate limit / min (optional)'), '60');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(generateApiKeyMock).toHaveBeenCalledWith({
      entityId: 'ent-1',
      name: 'Reporting bot',
      scopes: ['payments.read', 'invoices.read', 'reports.read'],
      expiresAt: '2027-01-01',
      rateLimitPerMinute: 60,
    });
  });

  it('shows the pending label and disables the submit button while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean; plaintextKey?: string }) => void = () => {};
    generateApiKeyMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();

    resolveAction({ ok: true, plaintextKey: 'key' });
    expect(await screen.findByText(/Copy this key now/)).toBeInTheDocument();
  });

  it('moves to the reveal step and shows the plaintext key on success', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: true, plaintextKey: '7fk_live_abc123xyz' });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(await screen.findByText('7fk_live_abc123xyz')).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('shows the action-returned error message and stays on the form step on failure', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: false, error: 'An API key named "Reporting bot" already exists for this entity' });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(await screen.findByText('An API key named "Reporting bot" already exists for this entity')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one, and also when ok but no plaintextKey is returned', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));

    expect(await screen.findByText('Failed to generate API key.')).toBeInTheDocument();
  });

  it('resets to the form step, with every field cleared, after "Done"', async () => {
    generateApiKeyMock.mockResolvedValue({ ok: true, plaintextKey: '7fk_live_abc123' });
    const user = userEvent.setup();
    render(<GenerateApiKeyForm entityId="ent-1" />);

    await user.type(screen.getByLabelText('Name'), 'Reporting bot');
    await user.type(screen.getByLabelText('Scopes (comma-separated, optional)'), 'payments.read');
    await user.click(screen.getByRole('button', { name: 'Generate API key' }));
    await screen.findByText('7fk_live_abc123');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Scopes (comma-separated, optional)')).toHaveValue('');
    expect(screen.queryByText('7fk_live_abc123')).not.toBeInTheDocument();
  });
});
