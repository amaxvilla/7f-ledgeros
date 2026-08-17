import * as React from 'react';
import {
  DataTableClient,
  DataTableClientColumn,
  DataTableClientFilter,
  DataTableClientRow,
} from './DataTableClient';

export interface DataTableColumn<T = any> {
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

export interface DataTableFilter<T = any> {
  label: string;
  options: { value: string; label: string }[];
  getValue: (row: T) => string;
}

export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  emptyMessage?: string;
  pageSize?: number;

  search?: {
    placeholder?: string;
    getText: (row: T) => string;
  };

  filters?: DataTableFilter<T>[];
}

export function DataTable<T = any>({
  columns,
  rows,
  keyOf,
  emptyMessage = 'Nothing to show.',
  pageSize = 20,
  search,
  filters,
}: DataTableProps<T>) {
  const clientColumns = React.useMemo<DataTableClientColumn[]>(
    () =>
      columns.map(({ header, align }) => ({
        header,
        align,
      })),
    [columns],
  );

  const clientRows = React.useMemo<DataTableClientRow<T>[]>(
    () =>
      rows.map((row) => ({
        id: keyOf(row),
        data: row,
        cells: columns.map((column) => column.render(row)),
        searchText: search?.getText(row),
        filterValues: filters?.map((filter) => filter.getValue(row)),
      })),
    [rows, columns, keyOf, search, filters],
  );

  const clientFilters = React.useMemo<
    DataTableClientFilter[] | undefined
  >(
    () =>
      filters?.map(({ label, options }) => ({
        label,
        options,
      })),
    [filters],
  );

  const clientSearch = React.useMemo(
    () => (search ? { placeholder: search.placeholder } : undefined),
    [search],
  );

  return (
    <DataTableClient
      columns={clientColumns}
      rows={clientRows}
      emptyMessage={emptyMessage}
      pageSize={pageSize}
      search={clientSearch}
      filters={clientFilters}
    />
  );
}
