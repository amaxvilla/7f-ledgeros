'use client';

import { PageHeader } from '@7f/ui';

export function InventoryReconciliationPanel() {
  return (
    <section>
      <PageHeader
        title="Inventory / GL reconciliation"
        subtitle="Compare inventory subledger value against the configured inventory control accounts."
      />

      <p>
        Reconciliation results will show subledger value, GL control-account
        value, variance and transaction-level drill-down.
      </p>
    </section>
  );
}