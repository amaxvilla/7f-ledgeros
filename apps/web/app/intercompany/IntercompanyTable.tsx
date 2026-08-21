'use client';

import * as React from 'react';
import { DataTableClient, Badge, Button, tokens } from '@7f/ui';
import { reconcileIntercompany, disputeIntercompany } from './actions';

export function IntercompanyTable({ transactions, entities }: { transactions: any[]; entities: any[] }) {
  const [pendingId, setPendingId] = React.useState('');

  async function handleAction(id: string, action: 'reconcile' | 'dispute') {
    setPendingId(id);
    try {
      if (action === 'reconcile') await reconcileIntercompany(id);
      if (action === 'dispute') await disputeIntercompany(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setPendingId('');
    }
  }

  const columns = [
    { key: 'initiator', header: 'Initiator', render: (row: any) => entities.find(e => e.id === row.initiatorEntityId)?.name || row.initiatorEntityId },
    { key: 'counterparty', header: 'Counterparty', render: (row: any) => entities.find(e => e.id === row.counterpartyEntityId)?.name || row.counterpartyEntityId },
    { key: 'amount', header: 'Amount', render: (row: any) => new Intl.NumberFormat("en-NG", { style: "currency", currency: row.currency }).format(Number(row.amount)) },
    { key: 'description', header: 'Description', render: (row: any) => row.description },
    { key: 'status', header: 'Status', render: (row: any) => <Badge tone={row.reconciliationStatus === 'RECONCILED' ? 'positive' : row.reconciliationStatus === 'DISPUTED' ? 'negative' : 'neutral'}>{row.reconciliationStatus}</Badge> },
    { key: 'actions', header: '', render: (row: any) => (
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        {row.reconciliationStatus !== 'RECONCILED' && (
          <Button variant="secondary" onClick={() => handleAction(row.id, 'reconcile')} disabled={!!pendingId}>Reconcile</Button>
        )}
        {row.reconciliationStatus !== 'DISPUTED' && (
          <Button variant="secondary" onClick={() => handleAction(row.id, 'dispute')} disabled={!!pendingId}>Dispute</Button>
        )}
      </div>
    )}
  ];

  return <DataTableClient columns={columns} rows={transactions} />;
}
