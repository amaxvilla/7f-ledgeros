import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationFilterForm } from '../NotificationFilterForm';

describe('NotificationFilterForm', () => {
  it('submits as a native GET form to /notifications — no fetch/action mock needed here', () => {
    render(<NotificationFilterForm />);

    const form = screen.getByRole('button', { name: 'Filter' }).closest('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/notifications');
  });

  it('names the fields status/channel/unreadOnly so they appear as query params on submit', () => {
    const { container } = render(<NotificationFilterForm />);

    expect(container.querySelector('select[name="status"]')).not.toBeNull();
    expect(container.querySelector('select[name="channel"]')).not.toBeNull();
    expect(container.querySelector('select[name="unreadOnly"]')).not.toBeNull();
  });

  it('defaults every field to "All" when no props are given', () => {
    render(<NotificationFilterForm />);

    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByLabelText('Channel')).toHaveValue('');
    expect(screen.getByLabelText('Read status')).toHaveValue('');
  });

  it('defaults status/channel/unreadOnly from props when provided', () => {
    render(<NotificationFilterForm status="FAILED" channel="EMAIL" unreadOnly="true" />);

    expect(screen.getByLabelText('Status')).toHaveValue('FAILED');
    expect(screen.getByLabelText('Channel')).toHaveValue('EMAIL');
    expect(screen.getByLabelText('Read status')).toHaveValue('true');
  });

  it('offers a real, selectable "All" option in each of the three selects', () => {
    render(<NotificationFilterForm />);

    expect(screen.getAllByRole('option', { name: 'All' })).toHaveLength(3);
  });

  it('offers every NotificationStatus value', () => {
    render(<NotificationFilterForm />);

    for (const label of ['Pending', 'Sent', 'Delivered', 'Read', 'Failed']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('offers every NotificationChannel value', () => {
    render(<NotificationFilterForm />);

    for (const label of ['In-app', 'Email', 'SMS', 'WhatsApp']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('updates the controlled value as the user picks a status', async () => {
    const user = userEvent.setup();
    render(<NotificationFilterForm />);

    await user.selectOptions(screen.getByLabelText('Status'), 'READ');
    expect(screen.getByLabelText('Status')).toHaveValue('READ');
  });

  it('lets the user return a selected filter back to "All"', async () => {
    const user = userEvent.setup();
    render(<NotificationFilterForm status="FAILED" />);

    await user.selectOptions(screen.getByLabelText('Status'), '');
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });
});
