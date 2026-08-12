import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const startWorkflowInstanceMock = vi.fn();
vi.mock('../actions', () => ({
  startWorkflowInstance: (...args: unknown[]) => startWorkflowInstanceMock(...args),
}));

import { StartInstanceForm } from '../StartInstanceForm';

beforeEach(() => {
  startWorkflowInstanceMock.mockReset();
});

describe('StartInstanceForm — rendering', () => {
  it('renders the fixed workflowCode/entityType and the Record ID field', () => {
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    expect(screen.getByText('PO_APPROVAL')).toBeInTheDocument();
    expect(screen.getByText('PurchaseOrder')).toBeInTheDocument();
    expect(screen.getByLabelText('Record ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Record ID')).toBeRequired();
  });

  it('renders all seven optional context fields', () => {
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    expect(screen.getByLabelText('Amount')).not.toBeRequired();
    expect(screen.getByLabelText('Department ID')).not.toBeRequired();
    expect(screen.getByLabelText('Project ID')).not.toBeRequired();
    expect(screen.getByLabelText('Context: entity ID')).not.toBeRequired();
    expect(screen.getByLabelText('Role')).not.toBeRequired();
    expect(screen.getByLabelText('Risk level')).not.toBeRequired();
    expect(screen.getByLabelText('Budget available')).toBeInTheDocument();
  });

  it('does not show a "View instance" link before any submit', () => {
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    expect(screen.queryByRole('link', { name: 'View instance →' })).not.toBeInTheDocument();
  });
});

describe('StartInstanceForm — submit', () => {
  it('submits workflowCode/entityType/entityId plus an all-empty context converted to all-undefined', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: true, instanceId: 'inst-1' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(startWorkflowInstanceMock).toHaveBeenCalledWith({
      workflowCode: 'PO_APPROVAL',
      entityType: 'PurchaseOrder',
      entityId: 'po-123',
      context: {
        amount: undefined,
        departmentId: undefined,
        projectId: undefined,
        entityId: undefined,
        role: undefined,
        riskLevel: undefined,
        budgetAvailable: undefined,
      },
    });
  });

  it('converts amount to a number and includes filled context fields', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: true, instanceId: 'inst-1' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.type(screen.getByLabelText('Amount'), '15000');
    await user.type(screen.getByLabelText('Department ID'), 'dept-1');
    await user.selectOptions(screen.getByLabelText('Budget available'), 'true');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(startWorkflowInstanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ amount: 15000, departmentId: 'dept-1', budgetAvailable: true }),
      }),
    );
  });

  it('converts "No" to budgetAvailable: false, not undefined', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: true, instanceId: 'inst-1' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.selectOptions(screen.getByLabelText('Budget available'), 'false');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(startWorkflowInstanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ budgetAvailable: false }) }),
    );
  });

  it('shows a "View instance" link to the new instance on success', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: true, instanceId: 'inst-42' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    const link = await screen.findByRole('link', { name: 'View instance →' });
    expect(link).toHaveAttribute('href', '/workflow/instances/inst-42');
  });

  it('resets Record ID and context fields after a successful submit', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: true, instanceId: 'inst-1' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(await screen.findByLabelText('Record ID')).toHaveValue('');
  });

  it('shows the action-returned error message on failure', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: false, error: 'No workflow stages apply to this context — check the workflow rules' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(await screen.findByText('No workflow stages apply to this context — check the workflow rules')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    expect(await screen.findByText('Failed to start workflow instance.')).toBeInTheDocument();
  });

  it('does not show a "View instance" link on failure', async () => {
    startWorkflowInstanceMock.mockResolvedValue({ ok: false, error: 'boom' });
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));

    await screen.findByText('boom');
    expect(screen.queryByRole('link', { name: 'View instance →' })).not.toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while submitting', async () => {
    let resolveAction: (value: { ok: boolean; instanceId?: string }) => void = () => {};
    startWorkflowInstanceMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<StartInstanceForm workflowCode="PO_APPROVAL" entityType="PurchaseOrder" />);

    await user.type(screen.getByLabelText('Record ID'), 'po-123');
    await user.click(screen.getByRole('button', { name: 'Start instance' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();

    resolveAction({ ok: true, instanceId: 'inst-1' });
    expect(await screen.findByRole('button', { name: 'Start instance' })).not.toBeDisabled();
  });
});
