import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsMenu } from '../NotificationsMenu';

const sampleNotification = { id: 'n1', title: 'Refresh failed', body: 'Dataset refresh failed', createdAt: '2026-07-31T00:00:00Z', readAt: null };

describe('NotificationsMenu', () => {
  it('renders the bell with no badge when unreadCount is 0', () => {
    render(<NotificationsMenu unreadCount={0} recent={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows the unread count badge when there are unread notifications', () => {
    render(<NotificationsMenu unreadCount={3} recent={[sampleNotification]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Notifications (3 unread)' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps the displayed badge at "9+" for large counts', () => {
    render(<NotificationsMenu unreadCount={42} recent={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('does not show the dropdown panel until clicked', () => {
    render(<NotificationsMenu unreadCount={1} recent={[sampleNotification]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click, showing recent notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={1} recent={[sampleNotification]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Notifications (1 unread)' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Refresh failed')).toBeInTheDocument();
    expect(screen.getByText('Dataset refresh failed')).toBeInTheDocument();
  });

  it('shows an empty state when there are no recent notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={0} recent={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('No unread notifications.')).toBeInTheDocument();
  });

  it('does not show "Mark all read" when unreadCount is 0', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={0} recent={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  it('calls onMarkRead with the notification id when its own "Mark read" is clicked', async () => {
    const onMarkRead = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={1} recent={[sampleNotification]} onMarkRead={onMarkRead} onMarkAllRead={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Notifications (1 unread)' }));
    await user.click(screen.getByRole('button', { name: 'Mark read' }));

    expect(onMarkRead).toHaveBeenCalledWith('n1');
  });

  it('calls onMarkAllRead when "Mark all read" is clicked', async () => {
    const onMarkAllRead = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={1} recent={[sampleNotification]} onMarkRead={vi.fn()} onMarkAllRead={onMarkAllRead} />);

    await user.click(screen.getByRole('button', { name: 'Notifications (1 unread)' }));
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('toggles the panel closed when clicked again', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenu unreadCount={0} recent={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    await user.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
