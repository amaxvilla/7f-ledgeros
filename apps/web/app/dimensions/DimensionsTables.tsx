'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  isActive: boolean;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  isActive: boolean;
}

export function DimensionsProjectsTable({
  rows,
}: {
  rows: Project[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Description' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Project>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.description ?? '—',
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No projects for this entity yet."
    />
  );
}

export function DimensionsVendorsTable({
  rows,
}: {
  rows: Vendor[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Tax ID' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Vendor>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.taxId ?? '—',
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No vendors configured yet."
    />
  );
}

export function DimensionsCustomersTable({
  rows,
}: {
  rows: Customer[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Customer>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.email ?? '—',
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
      (
        <Link
          key={`${row.id}-statement`}
          href={`/real-estate/customers/${row.id}/statement`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          Statement
        </Link>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No customers configured yet."
    />
  );
}
