import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceCertificateMock = vi.fn();
vi.mock('../actions', () => ({
  advanceCertificate: (...args: unknown[]) => advanceCertificateMock(...args),
}));

import { CertificateStatusActions } from '../CertificateStatusActions';

beforeEach(() => {
  advanceCertificateMock.mockReset();
});

describe('CertificateStatusActions', () => {
  it('shows "Advance to Reviewed" and "Reject" for a DRAFT certificate', () => {
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Advance to Approved" for a REVIEWED certificate', () => {
    render(<CertificateStatusActions id="cert-1" status="REVIEWED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Approved' })).toBeInTheDocument();
  });

  it('shows "Advance to Certified" for an APPROVED certificate', () => {
    render(<CertificateStatusActions id="cert-1" status="APPROVED" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Advance to Certified' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for an already-CERTIFIED certificate', () => {
    render(<CertificateStatusActions id="cert-1" status="CERTIFIED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED certificate', () => {
    render(<CertificateStatusActions id="cert-1" status="REJECTED" workPackageId="wp-1" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls advanceCertificate with (id, target, workPackageId) when Advance is clicked', async () => {
    advanceCertificateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(advanceCertificateMock).toHaveBeenCalledWith('cert-1', 'REVIEWED', 'wp-1');
  });

  it('calls advanceCertificate with REJECTED when Reject is clicked', async () => {
    advanceCertificateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(advanceCertificateMock).toHaveBeenCalledWith('cert-1', 'REJECTED', 'wp-1');
  });

  it('shows the action-returned error message on Advance failure', async () => {
    advanceCertificateMock.mockResolvedValue({ ok: false, error: 'Cannot advance from CERTIFIED to REVIEWED' });
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Cannot advance from CERTIFIED to REVIEWED')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    advanceCertificateMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(await screen.findByText('Failed to update certificate status.')).toBeInTheDocument();
  });

  it('disables both buttons and shows the pending label on the Advance button while advancing', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceCertificateMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Advance to Reviewed' }));

    expect(screen.getByRole('button', { name: 'Advancing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Advance to Reviewed' })).not.toBeDisabled();
  });

  it('disables both buttons and shows the pending label on the Reject button while rejecting', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    advanceCertificateMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<CertificateStatusActions id="cert-1" status="DRAFT" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance to Reviewed' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
