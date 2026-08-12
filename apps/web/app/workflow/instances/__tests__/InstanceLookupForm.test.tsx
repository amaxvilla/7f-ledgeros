import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstanceLookupForm } from '../InstanceLookupForm';

describe('InstanceLookupForm', () => {
  it('submits as a native GET form to /workflow/instances — no fetch/action mock needed here', () => {
    render(<InstanceLookupForm />);

    const form = screen.getByRole('button', { name: 'Find instances' }).closest('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/workflow/instances');
  });

  it('names the fields entityType/entityId so they appear as query params on submit', () => {
    const { container } = render(<InstanceLookupForm />);

    expect(container.querySelector('input[name="entityType"]')).not.toBeNull();
    expect(container.querySelector('input[name="entityId"]')).not.toBeNull();
  });

  it('defaults entityType/entityId from props when provided', () => {
    render(<InstanceLookupForm entityType="PurchaseOrder" entityId="po-1" />);

    expect(screen.getByLabelText('Entity type')).toHaveValue('PurchaseOrder');
    expect(screen.getByLabelText('Entity ID')).toHaveValue('po-1');
  });

  it('defaults to empty when no props are given', () => {
    render(<InstanceLookupForm />);

    expect(screen.getByLabelText('Entity type')).toHaveValue('');
    expect(screen.getByLabelText('Entity ID')).toHaveValue('');
  });

  it('marks both fields required', () => {
    render(<InstanceLookupForm />);

    expect(screen.getByLabelText('Entity type')).toBeRequired();
    expect(screen.getByLabelText('Entity ID')).toBeRequired();
  });

  it('updates the controlled value as the user types', async () => {
    const user = userEvent.setup();
    render(<InstanceLookupForm />);

    await user.type(screen.getByLabelText('Entity type'), 'Requisition');
    expect(screen.getByLabelText('Entity type')).toHaveValue('Requisition');
  });
});
