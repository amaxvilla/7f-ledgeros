import * as React from 'react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { DataTableClient } from '../DataTableClient';

interface Row {
  id: string;
  name: string;
}

const columns = [
  { header: 'Name' },
];

const rows = [
  {
    id: '1',
    data: { id: '1', name: 'Row 1' },
    cells: ['Row 1'],
  },
  {
    id: '2',
    data: { id: '2', name: 'Row 2' },
    cells: ['Row 2'],
  },
];

describe('DataTableClient — bulk actions', () => {
  it('renders no checkboxes or action bar unless bulkActions is provided', () => {
    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
      />,
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a checkbox per row plus a header select-all checkbox', () => {
    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    expect(
      screen.getByLabelText('Select all rows on this page'),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText('Select row 1'),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText('Select row 2'),
    ).toBeInTheDocument();
  });

  it('shows no action bar until at least one row is selected', async () => {
    const user = userEvent.setup();

    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Select row 1'));

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete' }),
    ).toBeInTheDocument();
  });

  it('passes selected row objects to renderActions', async () => {
    let received: Row[] = [];
    const user = userEvent.setup();

    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: (selectedRows) => {
            received = selectedRows;
            return <button>Delete</button>;
          },
        }}
      />,
    );

    await user.click(screen.getByLabelText('Select row 1'));
    await user.click(screen.getByLabelText('Select row 2'));

    expect(received).toEqual([
      { id: '1', name: 'Row 1' },
      { id: '2', name: 'Row 2' },
    ]);
  });

  it('clears selection when clearSelection is called', async () => {
    const user = userEvent.setup();

    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: (_selectedRows, clearSelection) => (
            <button onClick={clearSelection}>Clear</button>
          ),
        }}
      />,
    );

    await user.click(screen.getByLabelText('Select row 1'));

    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Select row 1'),
    ).not.toBeChecked();
  });

  it('selects and deselects every row on the current page', async () => {
    const user = userEvent.setup();

    render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    await user.click(
      screen.getByLabelText('Select all rows on this page'),
    );

    expect(
      screen.getByLabelText('Select row 1'),
    ).toBeChecked();

    expect(
      screen.getByLabelText('Select row 2'),
    ).toBeChecked();

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(
      screen.getByLabelText('Select all rows on this page'),
    );

    expect(
      screen.getByLabelText('Select row 1'),
    ).not.toBeChecked();

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('resets selection when the rows array reference changes', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <DataTableClient<Row>
        columns={columns}
        rows={rows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    await user.click(screen.getByLabelText('Select row 1'));

    expect(screen.getByText('1 selected')).toBeInTheDocument();

    const newRows = rows.map((row) => ({ ...row }));

    rerender(
      <DataTableClient<Row>
        columns={columns}
        rows={newRows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('preserves selection across a page change', async () => {
    const manyRows = Array.from({ length: 25 }, (_, index) => ({
      id: String(index + 1),
      data: {
        id: String(index + 1),
        name: `Row ${index + 1}`,
      },
      cells: [`Row ${index + 1}`],
    }));

    const user = userEvent.setup();

    render(
      <DataTableClient<Row>
        columns={columns}
        rows={manyRows}
        bulkActions={{
          renderActions: () => <button>Delete</button>,
        }}
      />,
    );

    await user.click(screen.getByLabelText('Select row 1'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});
