'use client';

import * as React from 'react';
import { DataTableClient, Badge, Button, tokens } from '@7f/ui';
import { initiateTransfer, verifyTransfer } from './actions';

export function TransfersTable({ transfers, entities }: { transfers: any[]; entities: any[] }) {
  const [pendingId, setPendingId] = React.useState('');

  async function handleAction(id: string, action: 'initiate' | 'verify') {
    setPendingId(id);
    try {
      if (action === 'initiate') await initiateTransfer(id);
      if (action === 'verify') await verifyTransfer(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setPendingId('');
    }
  }

  const columns = [
    { key: 'reference', header: 'Reference', render: (row: any) => row.reference },
    { key: 'entity', header: 'Entity', render: (row: any) => entities.find(e => e.id === row.entityId)?.name || row.entityId },
    { key: 'amount', header: 'Amount', render: (row: any) => new Intl.NumberFormat("en-NG", { style: "currency", currency: row.currency }).format(Number(row.amount)) },
    { key: 'destination', header: 'Destination', render: (row: any) => `${row.destinationBankCode} - ${row.destinationAccountNumber}` },
    { key: 'status', header: 'Status', render: (row: any) => <Badge tone={row.status === 'SUCCESSFUL' ? 'positive' : row.status === 'FAILED' ? 'negative' : 'neutral'}>{row.status}</Badge> },
    { key: 'actions', header: '', render: (row: any) => (
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        {row.status === 'PENDING' && (
          <Button variant="secondary" onClick={() => handleAction(row.id, 'initiate')} disabled={!!pendingId}>Initiate</Button>
        )}
        {(row.status === 'PROCESSING' || row.status === 'PENDING') && (
          <Button variant="secondary" onClick={() => handleAction(row.id, 'verify')} disabled={!!pendingId}>Verify</Button>
        )}
      </div>
    )}
  ];

  return <DataTableClient columns={columns} rows={transfers} />;
}
