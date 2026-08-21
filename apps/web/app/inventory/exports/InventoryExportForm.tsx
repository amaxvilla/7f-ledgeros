'use client';

import * as React from 'react';
import { Button, PageHeader, Select } from '@7f/ui';

export function InventoryExportForm() {
  const [type, setType] = React.useState('BALANCES');

  return (
    <section>
      <PageHeader
        title="Inventory export"
        subtitle="Export controlled inventory operational data for reporting and audit."
      />

      <Select
        label="Export type"
        value={type}
        onChange={(event) => setType(event.target.value)}
        options={[
          { value: 'BALANCES', label: 'Balances' },
          { value: 'MOVEMENTS', label: 'Movements' },
          { value: 'RECEIPTS', label: 'Goods receipts' },
          { value: 'ISSUES', label: 'Material issues' },
          { value: 'TRANSFERS', label: 'Stock transfers' },
          { value: 'COUNTS', label: 'Stock counts' },
        ]}
      />

      <Button type="button">
        Export CSV
      </Button>
    </section>
  );
}