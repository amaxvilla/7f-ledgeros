import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const perfectTitleDeedMock = vi.fn();
const rejectTitleDeedMock = vi.fn();
vi.mock('../actions', () => ({
  perfectTitleDeed: (...args: unknown[]) => perfectTitleDeedMock(...args),
  rejectTitleDeed: (...args: unknown[]) => rejectTitleDeedMock(...args),
}));

import { TitleDeedActions } from '../TitleDeedActions';

beforeEach(() => {
  perfectTitleDeedMock.mockReset();
  rejectTitleDeedMock.mockReset();
});

describe('TitleDeedActions — visibility', () => {
  it('shows Perfect and Reject for a PENDING title', () => {
    render(<TitleDeedActions id="title-1" status="PENDING" parcelId="parcel-1" />);

    expect(screen.getByRole('button', { name: 'Perfect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows Perfect and Reject for an IN_PROGRESS title', () => {
    render(<TitleDeedActions id="title-1" status="IN_PROGRESS" parcelId="parcel-1" />);

    expect(screen.getByRole('button', { name: 'Perfect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('renders nothing for an already-PERFECTED title', () => {
    const { container } = render(<TitleDeedActions id="title-1" status="PERFECTED" parcelId="parcel-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a REJECTED title', () => {
    const { container } = render(<TitleDeedActions id="title-1" status="REJECTED" parcelId="parcel-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an EXPIRED title', () => {
    const { container } = render(<TitleDeedActions id="title-1" status="EXPIRED" parcelId="parcel-1" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('TitleDeedActions — perfect', () => {
  it('calls perfectTitleDeed with the title id, entered fields, and parcelId on submit', async () => {
    perfectTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.type(screen.getByLabelText('Expiry (optional)'), '2036-08-01');
    await user.type(screen.getByLabelText('Title # (optional)'), 'C-O-12345');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));

    expect(perfectTitleDeedMock).toHaveBeenCalledWith(
      'title-42',
      { issuedDate: '2026-08-01', expiryDate: '2036-08-01', titleNumber: 'C-O-12345' },
      'parcel-7',
    );
  });

  it('omits expiryDate/titleNumber as undefined when left blank', async () => {
    perfectTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));

    expect(perfectTitleDeedMock).toHaveBeenCalledWith(
      'title-42',
      { issuedDate: '2026-08-01', expiryDate: undefined, titleNumber: undefined },
      'parcel-7',
    );
  });

  it('resets the perfect form fields after a successful submit', async () => {
    perfectTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.type(screen.getByLabelText('Title # (optional)'), 'C-O-12345');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));

    expect(await screen.findByLabelText('Issued date')).toHaveValue('');
    expect(screen.getByLabelText('Title # (optional)')).toHaveValue('');
  });

  it('shows the action-returned error message when perfect fails', async () => {
    perfectTitleDeedMock.mockResolvedValue({ ok: false, error: 'Title is already perfected' });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));

    expect(await screen.findByText('Title is already perfected')).toBeInTheDocument();
  });

  it('falls back to a generic error message when perfect fails without one', async () => {
    perfectTitleDeedMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));

    expect(await screen.findByText('Failed to perfect title deed.')).toBeInTheDocument();
  });

  it('disables the Perfect button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    perfectTitleDeedMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Issued date'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Perfect' }));
    expect(screen.getByRole('button', { name: 'Perfecting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Perfect' })).not.toBeDisabled();
  });
});

describe('TitleDeedActions — reject', () => {
  it('calls rejectTitleDeed with the title id, typed reason, and parcelId on submit', async () => {
    rejectTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Document illegible, resubmission required');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(rejectTitleDeedMock).toHaveBeenCalledWith('title-42', 'Document illegible, resubmission required', 'parcel-7');
  });

  it('clears the reason field after a successful reject', async () => {
    rejectTitleDeedMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Document illegible, resubmission required');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByLabelText('Rejection reason')).toHaveValue('');
  });

  it('shows the action-returned error message when reject fails', async () => {
    rejectTitleDeedMock.mockResolvedValue({ ok: false, error: 'Title deed not found' });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Document illegible, resubmission required');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Title deed not found')).toBeInTheDocument();
  });

  it('falls back to a generic error message when reject fails without one', async () => {
    rejectTitleDeedMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Document illegible, resubmission required');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Failed to reject title deed.')).toBeInTheDocument();
  });

  it('disables the Reject button and shows the pending label while in flight', async () => {
    let resolveAction: (value: { ok: boolean }) => void = () => {};
    rejectTitleDeedMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<TitleDeedActions id="title-42" status="IN_PROGRESS" parcelId="parcel-7" />);

    await user.type(screen.getByLabelText('Rejection reason'), 'Document illegible, resubmission required');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Rejecting…' })).toBeDisabled();

    resolveAction({ ok: true });
    expect(await screen.findByRole('button', { name: 'Reject' })).not.toBeDisabled();
  });
});
