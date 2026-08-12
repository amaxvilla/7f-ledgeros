import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateProviderMock = vi.fn();
vi.mock('../actions', () => ({
  updateProvider: (...args: unknown[]) => updateProviderMock(...args),
}));

import { UpdateProviderForm } from '../UpdateProviderForm';

beforeEach(() => {
  updateProviderMock.mockReset();
});

describe('UpdateProviderForm', () => {
  it('pre-populates fields from the provided initial values', () => {
    render(
      <UpdateProviderForm
        id="prov-1"
        initialName="AWS S3 (docs)"
        initialIsActive={true}
        initialRetryMaxAttempts={3}
        initialRetryBackoffMs={2000}
        initialConfig={{ bucket: 'my-bucket' }}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('AWS S3 (docs)');
    expect(screen.getByLabelText('Retry max attempts')).toHaveValue(3);
    expect(screen.getByLabelText('Retry backoff (ms)')).toHaveValue(2000);
    expect(screen.getByDisplayValue('bucket')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-bucket')).toBeInTheDocument();
  });

  it('submits the updated values, coercing isActive back to a boolean', async () => {
    updateProviderMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <UpdateProviderForm
        id="prov-1"
        initialName="AWS S3 (docs)"
        initialIsActive={true}
        initialRetryMaxAttempts={3}
        initialRetryBackoffMs={2000}
        initialConfig={null}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Status'), 'false');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateProviderMock).toHaveBeenCalledWith('prov-1', {
      name: 'AWS S3 (docs)',
      isActive: false,
      retryMaxAttempts: 3,
      retryBackoffMs: 2000,
      config: {},
    });
  });

  it('shows an error message when the action fails', async () => {
    updateProviderMock.mockResolvedValue({ ok: false, error: 'Provider not found.' });
    const user = userEvent.setup();
    render(
      <UpdateProviderForm
        id="prov-1"
        initialName="AWS S3 (docs)"
        initialIsActive={true}
        initialRetryMaxAttempts={3}
        initialRetryBackoffMs={2000}
        initialConfig={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Provider not found.')).toBeInTheDocument();
  });
});
