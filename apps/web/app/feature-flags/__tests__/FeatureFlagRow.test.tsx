import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const upsertFeatureFlagMock = vi.fn();
vi.mock('../actions', () => ({
  upsertFeatureFlag: (...args: unknown[]) => upsertFeatureFlagMock(...args),
}));

import { FeatureFlagRow } from '../FeatureFlagRow';

beforeEach(() => {
  upsertFeatureFlagMock.mockReset();
});

describe('FeatureFlagRow', () => {
  it('pre-populates fields from the provided initial values', () => {
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={true} initialDescription="New billing flow" initialRolloutPercent={50} />);

    expect(screen.getByLabelText('Status (billing.v2)')).toHaveValue('true');
    expect(screen.getByLabelText('Description (billing.v2)')).toHaveValue('New billing flow');
    expect(screen.getByLabelText('Rollout % (billing.v2)')).toHaveValue(50);
  });

  it('pre-populates a blank description and empty rollout % when both are null', () => {
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    expect(screen.getByLabelText('Description (billing.v2)')).toHaveValue('');
    expect(screen.getByLabelText('Rollout % (billing.v2)')).toHaveValue(null);
  });

  it('uses unique labels per row so two rows never collide', () => {
    render(
      <>
        <FeatureFlagRow flagKey="billing.v2" initialEnabled={true} initialDescription={null} initialRolloutPercent={null} />
        <FeatureFlagRow flagKey="checkout.v3" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />
      </>,
    );

    expect(screen.getByLabelText('Status (billing.v2)')).toBeInTheDocument();
    expect(screen.getByLabelText('Status (checkout.v3)')).toBeInTheDocument();
  });

  it('submits the edited values to upsertFeatureFlag', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    await user.selectOptions(screen.getByLabelText('Status (billing.v2)'), 'true');
    await user.type(screen.getByLabelText('Rollout % (billing.v2)'), '25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(upsertFeatureFlagMock).toHaveBeenCalledWith('billing.v2', {
      enabled: true,
      description: undefined,
      rolloutPercent: 25,
    });
  });

  it('shows a "Saved." confirmation and does not reset the fields after a successful save', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription="Old copy" initialRolloutPercent={10} />);

    await user.selectOptions(screen.getByLabelText('Status (billing.v2)'), 'true');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Status (billing.v2)')).toHaveValue('true');
    expect(screen.getByLabelText('Description (billing.v2)')).toHaveValue('Old copy');
  });

  it('shows the action-returned error message on failure', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: false, error: 'Rollout percent must be between 0 and 100' });
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rollout percent must be between 0 and 100')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    upsertFeatureFlagMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to save feature flag.')).toBeInTheDocument();
  });

  it('clears a prior success message when a new save fails', async () => {
    upsertFeatureFlagMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'Conflict' });
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Conflict')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('disables the Save button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    upsertFeatureFlagMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<FeatureFlagRow flagKey="billing.v2" initialEnabled={false} initialDescription={null} initialRolloutPercent={null} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
});
