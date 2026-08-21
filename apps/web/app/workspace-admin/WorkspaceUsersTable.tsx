'use client';

import * as React from 'react';
import { DataTableClient, Badge, Button, tokens } from '@7f/ui';
import { suspendDirectoryUser, deleteDirectoryUser } from './actions';

export function WorkspaceUsersTable({ users, providerCode }: { users: any[]; providerCode: string }) {
  const [pendingId, setPendingId] = React.useState('');

  async function handleSuspend(id: string, currentlySuspended: boolean) {
    setPendingId(id);
    try {
      await suspendDirectoryUser(providerCode, id, !currentlySuspended);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setPendingId('');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this directory user?')) return;
    setPendingId(id);
    try {
      await deleteDirectoryUser(providerCode, id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setPendingId('');
    }
  }

  const columns = [
    { key: 'email', header: 'Email', render: (row: any) => row.email },
    { key: 'name', header: 'Name', render: (row: any) => `${row.name?.givenName || ''} ${row.name?.familyName || ''}` },
    { key: 'status', header: 'Status', render: (row: any) => <Badge tone={row.suspended ? 'warning' : 'positive'}>{row.suspended ? 'Suspended' : 'Active'}</Badge> },
    { key: 'actions', header: '', render: (row: any) => (
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button variant="secondary" onClick={() => handleSuspend(row.id, !!row.suspended)} disabled={!!pendingId}>{row.suspended ? 'Unsuspend' : 'Suspend'}</Button>
        <Button variant="secondary" onClick={() => handleDelete(row.id)} disabled={!!pendingId}>Delete</Button>
      </div>
    )}
  ];

  return <DataTableClient columns={columns} rows={users} />;
}
