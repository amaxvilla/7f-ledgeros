import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submitJournalEntryMock = vi.fn();
const approveJournalEntryMock = vi.fn();
const rejectJournalEntryMock = vi.fn();
const postJournalEntryMock = vi.fn();
const reverseJournalEntryMock = vi.fn();

vi.mock('../actions', () => ({
  submitJournalEntry: (...args: unknown[]) => submitJournalEntryMock(...args),
  approveJournalEntry: (...args: unknown[]) => approveJournalEntryMock(...args),
  rejectJournalEntry: (...args: unknown[]) => rejectJournalEntryMock(...args),
  postJournalEntry: (...args: unknown[]) => postJournalEntryMock(...args),
  reverseJournalEntry: (...args: unknown[]) => reverseJournalEntryMock(...args),
}));

import { JournalEntryStatusActions } from '../JournalEntryStatusActions';

beforeEach(() => {
  submitJournalEntryMock.mockReset();
  approveJournalEntryMock.mockReset();
  rejectJournalEntryMock.mockReset();
  postJournalEntryMock.mockReset();
  reverseJournalEntryMock.mockReset();
});

describe('JournalEntryStatusActions', () => {
  it('shows "Submit for approval" for a DRAFT entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="DRAFT" />);
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });

  it('shows "Approve" and "Reject" for a PENDING_APPROVAL entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="PENDING_APPROVAL" />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows "Post" for an APPROVED entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="APPROVED" />);
    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
  });

  it('shows "Reverse" for a POSTED entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="POSTED" />);
    expect(screen.getByRole('button', { name: 'Reverse' })).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REVERSED entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="REVERSED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows no buttons, just a dash, for a REJECTED entry', () => {
    render(<JournalEntryStatusActions id="je-1" status="REJECTED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls submitJournalEntry when "Submit for approval" is clicked', async () => {
    submitJournalEntryMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JournalEntryStatusActions id="je-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));

    expect(submitJournalEntryMock).toHaveBeenCalledWith('je-42');
  });

  it('calls approveJournalEntry when "Approve" is clicked', async () => {
    approveJournalEntryMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JournalEntryStatusActions id="je-42" status="PENDING_APPROVAL" />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approveJournalEntryMock).toHaveBeenCalledWith('je-42');
  });

  it('calls postJournalEntry when "Post" is clicked', async () => {
    postJournalEntryMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JournalEntryStatusActions id="je-42" status="APPROVED" />);

    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(postJournalEntryMock).toHaveBeenCalledWith('je-42');
  });

  it('calls reverseJournalEntry when "Reverse" is clicked', async () => {
    reverseJournalEntryMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JournalEntryStatusActions id="je-42" status="POSTED" />);

    await user.click(screen.getByRole('button', { name: 'Reverse' }));

    expect(reverseJournalEntryMock).toHaveBeenCalledWith('je-42');
  });

  it('shows an error message when an action fails', async () => {
    submitJournalEntryMock.mockResolvedValue({ ok: false, error: 'Failed to submit journal entry.' });
    const user = userEvent.setup();
    render(<JournalEntryStatusActions id="je-42" status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Failed to submit journal entry.')).toBeInTheDocument();
  });
});
