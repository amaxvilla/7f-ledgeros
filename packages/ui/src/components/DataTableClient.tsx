'use client';

import * as React from 'react';
import { tokens } from '../tokens';
import { Select } from './Form';

export interface DataTableClientColumn {
  header: string;
  align?: 'left' | 'right';
}

export interface DataTableClientRow<T = unknown> {
  id: string;
  data: T;
  cells: React.ReactNode[];
  searchText?: string;
  filterValues?: string[];
}

export interface DataTableClientFilter {
  label: string;
  options: { value: string; label: string }[];
}

export interface DataTableClientBulkActions<T = unknown> {
  renderActions: (
    selectedRows: T[],
    clearSelection: () => void,
  ) => React.ReactNode;
}

export interface DataTableClientProps<T = unknown> {
  columns: DataTableClientColumn[];
  rows: DataTableClientRow<T>[];
  emptyMessage?: string;
  pageSize?: number;
  search?: {
    placeholder?: string;
  };
  filters?: DataTableClientFilter[];
  bulkActions?: DataTableClientBulkActions<T>;
}

export function DataTableClient<T = unknown>({
  columns,
  rows,
  emptyMessage = 'Nothing to show.',
  pageSize = 20,
  search,
  filters,
  bulkActions,
}: DataTableClientProps<T>) {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [filterValues, setFilterValues] = React.useState<string[]>(
    () => (filters ?? []).map(() => ''),
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    setPage(1);
  }, [rows, query, filterValues]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: tokens.space(6),
          color: tokens.color.textMuted,
          fontFamily: tokens.font.body,
          fontSize: '13px',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const filteredRows = rows.filter((row) => {
    const matchesFilters =
      !filters ||
      filters.every(
        (_filter, index) =>
          filterValues[index] === '' ||
          row.filterValues?.[index] === filterValues[index],
      );

    if (!matchesFilters) {
      return false;
    }

    if (!search || !query.trim()) {
      return true;
    }

    return (row.searchText ?? '')
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const effectivePageSize = Math.max(1, pageSize);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / effectivePageSize),
  );

  const clampedPage = Math.min(page, totalPages);

  const start = (clampedPage - 1) * effectivePageSize;

  const pageRows = filteredRows.slice(
    start,
    start + effectivePageSize,
  );

  const selectedRows = rows
    .filter((row) => selectedIds.has(row.id))
    .map((row) => row.data);

  const pageRowIds = pageRows.map((row) => row.id);
  const allPageRowsSelected =
    bulkActions !== undefined &&
    pageRowIds.length > 0 &&
    pageRowIds.every((id) => selectedIds.has(id));

  function toggleRow(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function togglePageSelection() {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (allPageRowsSelected) {
        for (const id of pageRowIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageRowIds) {
          next.add(id);
        }
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div>
      {(filters || search) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: tokens.space(3),
            alignItems: 'flex-end',
            marginBottom: tokens.space(3),
          }}
        >
          {filters &&
            filters.map((filter, index) => (
              <Select
                key={filter.label}
                label={filter.label}
                value={filterValues[index] ?? ''}
                onChange={(event) =>
                  setFilterValues((previous) => {
                    const next = [...previous];
                    next[index] = event.target.value;
                    return next;
                  })
                }
                options={[
                  {
                    value: '',
                    label: `All ${filter.label.toLowerCase()}`,
                  },
                  ...filter.options,
                ]}
                style={{ minWidth: '160px' }}
              />
            ))}

          {search && (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={search.placeholder ?? 'Search…'}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: '320px',
                background: tokens.color.surfaceRaised,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.sm,
                color: tokens.color.textPrimary,
                padding: `${tokens.space(2)} ${tokens.space(3)}`,
                fontFamily: tokens.font.body,
                fontSize: '13px',
              }}
            />
          )}
        </div>
      )}

      {bulkActions && selectedRows.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space(3),
            marginBottom: tokens.space(3),
            padding: `${tokens.space(2)} ${tokens.space(3)}`,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            background: tokens.color.surfaceRaised,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          <span>{selectedRows.length} selected</span>
          {bulkActions.renderActions(selectedRows, clearSelection)}
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div
          style={{
            padding: tokens.space(6),
            color: tokens.color.textMuted,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          {search && query.trim()
            ? 'No results match your search.'
            : 'No results match the selected filters.'}
        </div>
      ) : (
        <>
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '480px',
                borderCollapse: 'collapse',
                fontFamily: tokens.font.body,
              }}
            >
              <thead>
                <tr>
                  {bulkActions && (
                    <th
                      style={{
                        width: '40px',
                        textAlign: 'center',
                        borderBottom: `1px solid ${tokens.color.border}`,
                        padding: `${tokens.space(2)} ${tokens.space(1)}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select all rows on this page"
                        checked={allPageRowsSelected}
                        onChange={togglePageSelection}
                      />
                    </th>
                  )}

                  {columns.map((column) => (
                    <th
                      key={column.header}
                      style={{
                        textAlign: column.align ?? 'left',
                        fontSize: '11px',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: tokens.color.textMuted,
                        borderBottom: `1px solid ${tokens.color.border}`,
                        padding: `${tokens.space(2)} ${tokens.space(3)}`,
                      }}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    {bulkActions && (
                      <td
                        style={{
                          width: '40px',
                          textAlign: 'center',
                          padding: `${tokens.space(3)} ${tokens.space(1)}`,
                          borderBottom: `1px solid ${tokens.color.border}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select row ${row.id}`}
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                    )}

                    {row.cells.map((cell, index) => {
                      const column = columns[index];

                      return (
                        <td
                          key={`${row.id}-${column.header}`}
                          style={{
                            textAlign: column.align ?? 'left',
                            padding: `${tokens.space(3)} ${tokens.space(3)}`,
                            borderBottom: `1px solid ${tokens.color.border}`,
                            fontFamily:
                              column.align === 'right'
                                ? tokens.font.mono
                                : tokens.font.body,
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '13px',
                            color: tokens.color.textPrimary,
                          }}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length > effectivePageSize && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: tokens.space(3),
                padding: `${tokens.space(3)} ${tokens.space(1)}`,
                fontFamily: tokens.font.body,
                fontSize: '12px',
                color: tokens.color.textMuted,
              }}
            >
              <span>
                {start + 1}–
                {Math.min(
                  start + effectivePageSize,
                  filteredRows.length,
                )}{' '}
                of {filteredRows.length}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((previous) => Math.max(1, previous - 1))
                }
                disabled={clampedPage === 1}
                style={{
                  background: 'transparent',
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.sm,
                  color: tokens.color.textPrimary,
                  padding: `${tokens.space(1)} ${tokens.space(2)}`,
                  fontFamily: tokens.font.body,
                  fontSize: '12px',
                  cursor:
                    clampedPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: clampedPage === 1 ? 0.5 : 1,
                }}
              >
                Prev
              </button>

              <button
                type="button"
                onClick={() =>
                  setPage((previous) =>
                    Math.min(totalPages, previous + 1),
                  )
                }
                disabled={clampedPage === totalPages}
                style={{
                  background: 'transparent',
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.sm,
                  color: tokens.color.textPrimary,
                  padding: `${tokens.space(1)} ${tokens.space(2)}`,
                  fontFamily: tokens.font.body,
                  fontSize: '12px',
                  cursor:
                    clampedPage === totalPages
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    clampedPage === totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
