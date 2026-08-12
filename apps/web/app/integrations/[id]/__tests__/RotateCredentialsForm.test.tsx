import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rotateCredentialsMock = vi.fn();
vi.mock('../actions', () => ({
  rotateCredentials: (...args: unknown[]) => rotateCredentialsMock(...args),
}));

import { RotateCredentialsForm } from '../RotateCredentialsForm';

beforeEach(() => {
  rotateCredentialsMock.mockReset();
});

// Verification pass addendum: `KeyValueEditor`'s per-row labels
// changed from a static 'Key'/'Value' (only on the first row) to a
// unique 'Key (row N)'/'Value (row N)' per row — see that
// component's own doc comment for why (a real `tsc --noEmit` error,
// `TextFieldProps.label` is required, not `string | undefined`).
// This form always starts with exactly one row, so 'row 1' is the
// only value these assertions ever need.
describe('RotateCredentialsForm', () => {
  it('starts with one empty key/value row', () => {
    render(<RotateCredentialsForm id="prov-1" />);

    // `getByDisplayValue('')` is ambiguous here — both the Key and
    // Value inputs of a single empty row match an empty string, so it
    // throws "multiple elements found" rather than confirming anything
    // (a real, pre-existing bug in this assertion, found by actually
    // running this test — fixed by asserting on the row's own unique
    // labels instead, which is also a more precise check of "exactly
    // one row" than counting empty-valued inputs ever was).
    expect(screen.getByLabelText('Key (row 1)')).toHaveValue('');
    expect(screen.getByLabelText('Value (row 1)')).toHaveValue('');
    expect(screen.queryByLabelText('Key (row 2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rotate credentials' })).toBeInTheDocument();
  });

  it('submits the entered credentials to rotateCredentials', async () => {
    rotateCredentialsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RotateCredentialsForm id="prov-1" />);

    const keyInput = screen.getByLabelText('Key (row 1)');
    const valueInput = screen.getByLabelText('Value (row 1)');
    await user.type(keyInput, 'apiKey');
    await user.type(valueInput, 'sk_live_12345');
    await user.click(screen.getByRole('button', { name: 'Rotate credentials' }));

    expect(rotateCredentialsMock).toHaveBeenCalledWith('prov-1', { apiKey: 'sk_live_12345' });
  });

  it('shows a success message and resets the form after a successful submission', async () => {
    rotateCredentialsMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RotateCredentialsForm id="prov-1" />);

    await user.type(screen.getByLabelText('Key (row 1)'), 'apiKey');
    await user.type(screen.getByLabelText('Value (row 1)'), 'sk_live_12345');
    await user.click(screen.getByRole('button', { name: 'Rotate credentials' }));

    expect(await screen.findByText('Credentials rotated.')).toBeInTheDocument();
    expect(screen.getByLabelText('Key (row 1)')).toHaveValue('');
  });

  it('shows an error message when the action fails', async () => {
    rotateCredentialsMock.mockResolvedValue({ ok: false, error: 'Failed to rotate credentials.' });
    const user = userEvent.setup();
    render(<RotateCredentialsForm id="prov-1" />);

    await user.type(screen.getByLabelText('Key (row 1)'), 'apiKey');
    await user.type(screen.getByLabelText('Value (row 1)'), 'sk_live_12345');
    await user.click(screen.getByRole('button', { name: 'Rotate credentials' }));

    expect(await screen.findByText('Failed to rotate credentials.')).toBeInTheDocument();
  });
});
