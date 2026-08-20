'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { ActivateAccountForm } from './ActivateAccountForm';
import { AccountActions } from './AccountActions';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  ifrsMapping?: string | null;
  isControlAccount?: boolean;
  isPostable?: boolean;
  isActive: boolean;
  parentAccountId?: string | null;
  parentAccount?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export function EntityAccountActivationTable({
  rows,
  entityId,
}: {
  rows: Account[];
  entityId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Category' },
    { header: 'Action', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Account>[] = rows.map((row) => ({
    id: `entity-${row.id}`,
    data: row,
    searchText: `${row.code} ${row.name} ${row.accountCategory}`,
    cells: [
      row.code,
      row.name,
      row.accountType,
      row.accountCategory,
      row.isActive ? (
        <ActivateAccountForm
          key={`${row.id}-activate`}
          accountId={row.id}
          entityId={entityId}
        />
      ) : (
        <Badge key={`${row.id}-inactive`} tone="neutral">
          Inactive
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No accounts available for activation."
      search={{ placeholder: 'Search accounts...' }}
    />
  );
}

export function AccountRegisterTable({
  rows,
}: {
  rows: Account[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Category' },
    { header: 'Parent' },
    { header: 'Postable' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Account>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.code} ${row.name} ${row.accountType} ${row.accountCategory} ${row.ifrsMapping ?? ''}`,
    cells: [
      row.code,
      row.name,
      row.accountType,
      row.accountCategory,
      row.parentAccount
        ? `${row.parentAccount.code} — ${row.parentAccount.name}`
        : '—',
      (
        <Badge
          key={`${row.id}-postable`}
          tone={row.isPostable ? 'positive' : 'neutral'}
        >
          {row.isPostable ? 'Yes' : 'No'}
        </Badge>
      ),
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
      (
        <AccountActions
          key={`${row.id}-actions`}
          id={row.id}
          isActive={row.isActive}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No accounts configured yet."
      search={{
        placeholder: 'Search by code, name, type or category...',
      }}
    />
  );
}
