import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const generateCertificateMock = vi.fn();
vi.mock('../actions', () => ({
  generateCertificate: (...args: unknown[]) => generateCertificateMock(...args),
}));

import { GenerateCertificateForm } from '../GenerateCertificateForm';

beforeEach(() => {
  generateCertificateMock.mockReset();
});

async function expandAndFill(
  user: ReturnType<typeof userEvent.setup>,
  { certificateNumber = 'IPC-001', retentionPercent = '10', issuedDate = '2026-08-01' }: { certificateNumber?: string; retentionPercent?: string; issuedDate?: string } = {},
) {
  await user.click(screen.getByRole('button', { name: 'Generate certificate' }));
  await user.type(screen.getByLabelText('Certificate #'), certificateNumber);
  await user.type(screen.getByLabelText('Retention %'), retentionPercent);
  await user.type(screen.getByLabelText('Issued date'), issuedDate);
}

describe('GenerateCertificateForm', () => {
  it('starts collapsed, showing only the Generate certificate button', () => {
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    expect(screen.getByRole('button', { name: 'Generate certificate' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Certificate #')).not.toBeInTheDocument();
  });

  it('expands to show all three fields and a Cancel button when clicked', async () => {
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Generate certificate' }));

    expect(screen.getByLabelText('Certificate #')).toBeInTheDocument();
    expect(screen.getByLabelText('Retention %')).toBeInTheDocument();
    expect(screen.getByLabelText('Issued date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('collapses back without submitting when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await user.click(screen.getByRole('button', { name: 'Generate certificate' }));
    await user.type(screen.getByLabelText('Certificate #'), 'IPC-001');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Generate certificate' })).toBeInTheDocument();
    expect(generateCertificateMock).not.toHaveBeenCalled();
  });

  it('submits with numeric retentionPercent conversion and both id props', async () => {
    generateCertificateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await expandAndFill(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(generateCertificateMock).toHaveBeenCalledWith({
      progressValuationId: 'pv-1',
      workPackageId: 'wp-1',
      certificateNumber: 'IPC-001',
      retentionPercent: 10,
      issuedDate: '2026-08-01',
    });
  });

  it('shows the action-returned error message on failure', async () => {
    generateCertificateMock.mockResolvedValue({ ok: false, error: 'This progress valuation already has a certificate' });
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await expandAndFill(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText('This progress valuation already has a certificate')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    generateCertificateMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await expandAndFill(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText('Failed to generate certificate.')).toBeInTheDocument();
  });

  it('collapses back to the single button after a successful submit', async () => {
    generateCertificateMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await expandAndFill(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByRole('button', { name: 'Generate certificate' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Certificate #')).not.toBeInTheDocument();
  });

  it('disables the Generate button and shows the pending label while the request is in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    generateCertificateMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<GenerateCertificateForm progressValuationId="pv-1" workPackageId="wp-1" />);

    await expandAndFill(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Generate certificate' })).toBeInTheDocument();
  });
});
