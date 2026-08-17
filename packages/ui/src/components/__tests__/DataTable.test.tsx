import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from '../DataTable';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: DataTableColumn<Row>[] = [
  { header: 'Name', render: (row) => row.name },
  { header: 'Amount', align: 'right', render: (row) => row.amount.toFixed(2) },
];

const rows: Row[] = [
  { id: '1', name: 'Alpha', amount: 100 },
  { id: '2', name: 'Beta', amount: 250.5 },
];

describe('DataTable — empty state', () => {
  it('renders the default empty message and no table when rows is empty', () => {
    render(<DataTable columns={columns} rows={[]} keyOf={(r) => r.id} />);

    expect(screen.getByText('Nothing to show.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a custom emptyMessage when provided', () => {
    render(
      <DataTable columns={columns} rows={[]} keyOf={(r) => r.id} emptyMessage="No transactions yet." />,
    );

    expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to show.')).not.toBeInTheDocument();
  });
});

describe('DataTable — populated rows', () => {
  it('renders a scroll wrapper around the table with a minWidth floor, and no empty message', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    expect(screen.queryByText('Nothing to show.')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table).toHaveStyle({ minWidth: '480px' });

    // The wrapper is the table's direct parent and is the element that
    // owns the horizontal-scroll escape hatch — asserted on the wrapper,
    // not the table, since the table itself stays width: 100%.
    const wrapper = table.parentElement as HTMLElement;
    expect(wrapper).toHaveStyle({ overflowX: 'auto' });
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('FC-4 — gives body cells 12px vertical padding, a real (if modest) mobile touch-target improvement over the header row', () => {
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    const nameCell = screen.getByText('Alpha');
    expect(nameCell).toHaveStyle({ padding: '12px 12px' });
  });

  it('renders one row per data item, keyed and rendered via the column definitions', () => {
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('100.00')).toBeInTheDocument();
    expect(screen.getByText('250.50')).toBeInTheDocument();

    // One row per data item, plus the header row.
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  it('right-aligns and applies the mono font to right-aligned columns only', () => {
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    const nameCell = screen.getByText('Alpha');
    const amountCell = screen.getByText('100.00');

    expect(nameCell).toHaveStyle({ textAlign: 'left' });
    expect(amountCell).toHaveStyle({ textAlign: 'right' });
  });
});

describe('DataTable — pagination (FC-1.1)', () => {
  const manyRows: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}`, amount: i }));

  it('renders no pagination controls when rows.length is within the default page size', () => {
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument();
  });

  it('shows only the first page of rows and a range label when rows.length exceeds the page size', () => {
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} />);

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 20')).toBeInTheDocument();
    expect(screen.queryByText('Row 21')).not.toBeInTheDocument();
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
  });

  it('disables "Prev" on the first page and enables "Next"', () => {
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} />);

    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('advances to the next page and shows the correct slice and range', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
    expect(screen.getByText('Row 21')).toBeInTheDocument();
    expect(screen.getByText('Row 40')).toBeInTheDocument();
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();
  });

  it('disables "Next" on the last (partial) page', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Row 41')).toBeInTheDocument();
    expect(screen.getByText('Row 45')).toBeInTheDocument();
    expect(screen.getByText('41–45 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('respects a custom pageSize prop', () => {
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} pageSize={10} />);

    expect(screen.getByText('Row 10')).toBeInTheDocument();
    expect(screen.queryByText('Row 11')).not.toBeInTheDocument();
    expect(screen.getByText('1–10 of 45')).toBeInTheDocument();
  });

  it('resets to page 1 when the rows array reference changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();

    const newRows = manyRows.slice(0, 5);
    rerender(<DataTable columns={columns} rows={newRows} keyOf={(r) => r.id} />);

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});

describe('DataTable — search (FC-1.2)', () => {
  it('renders no search box unless the search prop is provided', () => {
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} />);

    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
  });

  it('renders a search box with a default or custom placeholder when the search prop is provided', () => {
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} keyOf={(r) => r.id} search={{ getText: (r) => r.name }} />,
    );
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();

    rerender(
      <DataTable columns={columns} rows={rows} keyOf={(r) => r.id} search={{ getText: (r) => r.name, placeholder: 'Search accounts…' }} />,
    );
    expect(screen.getByPlaceholderText('Search accounts…')).toBeInTheDocument();
  });

  it('filters rows by a case-insensitive substring match against getText', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} search={{ getText: (r) => r.name }} />);

    await user.type(screen.getByPlaceholderText('Search…'), 'alpha');

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('shows a "no results" message when nothing matches, without hiding the search box', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} keyOf={(r) => r.id} search={{ getText: (r) => r.name }} />);

    await user.type(screen.getByPlaceholderText('Search…'), 'zzz-nonexistent');

    expect(screen.getByText('No results match your search.')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('resets to page 1 when the query changes', async () => {
    const manyRows: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}`, amount: i }));
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyRows} keyOf={(r) => r.id} search={{ getText: (r) => r.name }} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();

    // "Row 2" matches Row 2 and Row 20-29 — 11 rows, which now fits on
    // one page. If pagination were still stuck on the old page 2, none
    // of these would be visible; if it correctly reset, all are.
    await user.type(screen.getByPlaceholderText('Search…'), 'Row 2');

    expect(screen.getByText('Row 2')).toBeInTheDocument();
    expect(screen.getByText('Row 20')).toBeInTheDocument();
    expect(screen.getByText('Row 29')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});

interface StatusRow {
  id: string;
  name: string;
  status: string;
}

const statusRows: StatusRow[] = [
  { id: '1', name: 'Alpha', status: 'ACTIVE' },
  { id: '2', name: 'Beta', status: 'INACTIVE' },
  { id: '3', name: 'Gamma', status: 'ACTIVE' },
];

const statusColumns: DataTableColumn<StatusRow>[] = [
  { header: 'Name', render: (row) => row.name },
  { header: 'Status', render: (row) => row.status },
];

const STATUS_FILTER = {
  label: 'Status',
  options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ],
  getValue: (row: StatusRow) => row.status,
};

describe('DataTable — filters (FC-1.3)', () => {
  it('renders no filter dropdown unless the filters prop is provided', () => {
    render(<DataTable columns={statusColumns} rows={statusRows} keyOf={(r) => r.id} />);

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });

  it('renders one dropdown per filter, each starting on "All <label>"', () => {
    render(<DataTable columns={statusColumns} rows={statusRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'All status' })).toBeInTheDocument();
  });

  it('shows every row when the filter is left on "All"', () => {
    render(<DataTable columns={statusColumns} rows={statusRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('narrows rows to those matching the selected filter value', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={statusColumns} rows={statusRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('re-selecting "All <label>" clears the filter back to every row', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={statusColumns} rows={statusRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'All status');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('combines a filter and a search query with AND semantics', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={statusColumns}
        rows={statusRows}
        keyOf={(r) => r.id}
        filters={[STATUS_FILTER]}
        search={{ getText: (r) => r.name }}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Status'), 'ACTIVE');
    await user.type(screen.getByPlaceholderText('Search…'), 'gamma');

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows a "no results match the selected filters" message when a filter alone excludes everything', async () => {
    const onlyActiveRows: StatusRow[] = [{ id: '1', name: 'Alpha', status: 'ACTIVE' }];
    const user = userEvent.setup();
    render(<DataTable columns={statusColumns} rows={onlyActiveRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');

    expect(screen.getByText('No results match the selected filters.')).toBeInTheDocument();
  });

  it('resets to page 1 when a filter value changes', async () => {
    const manyStatusRows: StatusRow[] = Array.from({ length: 60 }, (_, i) => ({
      id: String(i + 1),
      name: `Row ${i + 1}`,
      status: i < 25 ? 'ACTIVE' : 'INACTIVE',
    }));
    const user = userEvent.setup();
    render(<DataTable columns={statusColumns} rows={manyStatusRows} keyOf={(r) => r.id} filters={[STATUS_FILTER]} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('21–40 of 60')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');

    // 35 INACTIVE rows (i=25..59) — still more than one page, so if the
    // reset worked this is page 1 of the newly-filtered set; if it
    // didn't, we'd still be looking at the old page 2's row range.
    expect(screen.getByText('Row 26')).toBeInTheDocument();
    expect(screen.getByText('1–20 of 35')).toBeInTheDocument();
  });
});
