'use client';

import { PageHeader } from '@7f/ui';

export function InventoryAccountingConfigForm() {
  return (
    <section>
      <PageHeader
        title="Inventory accounting configuration"
        subtitle="Configure inventory asset, GRNI, COGS and inventory variance accounts by entity."
      />

      <p>
        Accounting mappings are controlled centrally and must be configured
        before inventory financial events can be posted to the general ledger.
      </p>
    </section>
  );
}