import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const publishDatasetMock = vi.fn();
vi.mock('../actions', () => ({
  publishDataset: (...args: unknown[]) => publishDatasetMock(...args),
}));

import { PublishDatasetForm } from '../PublishDatasetForm';

beforeEach(() => {
  publishDatasetMock.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Provider code'));
  await user.type(screen.getByLabelText('Provider code'), 'POWER_BI');
  await user.type(screen.getByLabelText('Dataset name'), 'Finance Overview');
  await user.type(screen.getByLabelText('Table name'), 'MonthlyRevenue');
}

describe('PublishDatasetForm — fields', () => {
  it('pre-fills Provider code with POWER_BI, and renders every other field with one column row by default', () => {
    render(<PublishDatasetForm />);

    expect(screen.getByLabelText('Provider code')).toHaveValue('POWER_BI');
    expect(screen.getByLabelText('Dataset name')).toHaveValue('');
    expect(screen.getByLabelText('Table name')).toHaveValue('');
    expect(screen.getByLabelText('Column name (1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Data type (1)')).toHaveValue('string');
    expect(screen.queryByLabelText('Column name (2)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish dataset' })).toBeInTheDocument();
  });

  it('lists all four Power BI column data types', () => {
    render(<PublishDatasetForm />);

    expect(screen.getByRole('option', { name: 'String' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Number' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Boolean' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DateTime' })).toBeInTheDocument();
  });

  it('marks Provider code/Dataset name/Table name as required, but leaves column name and data type unrequired', () => {
    render(<PublishDatasetForm />);

    expect(screen.getByLabelText('Provider code')).toBeRequired();
    expect(screen.getByLabelText('Dataset name')).toBeRequired();
    expect(screen.getByLabelText('Table name')).toBeRequired();
    expect(screen.getByLabelText('Column name (1)')).not.toBeRequired();
    expect(screen.getByLabelText('Data type (1)')).not.toBeRequired();
  });
});

describe('PublishDatasetForm — dynamic column rows', () => {
  it('adds a new column row on "+ Add column"', async () => {
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await user.click(screen.getByRole('button', { name: '+ Add column' }));

    expect(screen.getByLabelText('Column name (2)')).toBeInTheDocument();
  });

  it('removes a column row on "Remove", including the last remaining one (no disabled guard at one row)', async () => {
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    // Genuinely different from this app's other dynamic line-item forms
    // (e.g. SubdividePlotsForm): this component's own Remove button has
    // no `disabled={columns.length === 1}` guard at all — confirmed
    // directly against the source before writing this assertion, not
    // assumed to match the more common pattern.
    expect(screen.getByRole('button', { name: 'Remove' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByLabelText('Column name (1)')).not.toBeInTheDocument();
  });
});

describe('PublishDatasetForm — submission', () => {
  it('submits a single named column, with the table wrapped in a one-element tables array', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true, data: { providerDatasetId: 'ds-123' } });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Column name (1)'), 'Revenue');
    await user.selectOptions(screen.getByLabelText('Data type (1)'), 'number');
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(publishDatasetMock).toHaveBeenCalledWith({
      providerCode: 'POWER_BI',
      datasetName: 'Finance Overview',
      tables: [{ name: 'MonthlyRevenue', columns: [{ name: 'Revenue', dataType: 'number' }] }],
    });
  });

  it('filters out blank-named columns before submitting, keeping only named ones', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true, data: { providerDatasetId: 'ds-123' } });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Column name (1)'), 'Revenue');
    await user.click(screen.getByRole('button', { name: '+ Add column' }));
    // Column (2) deliberately left blank.
    await user.click(screen.getByRole('button', { name: '+ Add column' }));
    await user.type(screen.getByLabelText('Column name (3)'), 'Month');

    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(publishDatasetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tables: [
          {
            name: 'MonthlyRevenue',
            columns: [
              { name: 'Revenue', dataType: 'string' },
              { name: 'Month', dataType: 'string' },
            ],
          },
        ],
      }),
    );
  });

  it('submits an empty columns array when every column is removed', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true, data: { providerDatasetId: 'ds-123' } });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(publishDatasetMock).toHaveBeenCalledWith(
      expect.objectContaining({ tables: [{ name: 'MonthlyRevenue', columns: [] }] }),
    );
  });

  it('shows the returned provider dataset id on success', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true, data: { providerDatasetId: 'ds-abc-123' } });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(await screen.findByText('ds-abc-123')).toBeInTheDocument();
  });

  it('does NOT reset any field after a successful submit', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true, data: { providerDatasetId: 'ds-123' } });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Column name (1)'), 'Revenue');
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    await screen.findByText('ds-123');
    expect(screen.getByLabelText('Dataset name')).toHaveValue('Finance Overview');
    expect(screen.getByLabelText('Table name')).toHaveValue('MonthlyRevenue');
    expect(screen.getByLabelText('Column name (1)')).toHaveValue('Revenue');
  });

  it('shows the action-returned error message on failure', async () => {
    publishDatasetMock.mockResolvedValue({ ok: false, error: 'Dataset name already in use for this provider' });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(await screen.findByText('Dataset name already in use for this provider')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the action fails without one', async () => {
    publishDatasetMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(await screen.findByText('Failed to publish dataset.')).toBeInTheDocument();
  });

  it('treats an ok:true response with no data the same as a failure (no crash, no success message)', async () => {
    publishDatasetMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    expect(await screen.findByText('Failed to publish dataset.')).toBeInTheDocument();
  });

  it('disables the submit button and shows the pending label while the action is in flight', async () => {
    let resolveAction: (value: { ok: boolean; data?: { providerDatasetId: string } }) => void = () => {};
    publishDatasetMock.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const user = userEvent.setup();
    render(<PublishDatasetForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Publish dataset' }));

    const pendingButton = screen.getByRole('button', { name: 'Publishing…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true, data: { providerDatasetId: 'ds-123' } });
    expect(await screen.findByRole('button', { name: 'Publish dataset' })).not.toBeDisabled();
  });
});
