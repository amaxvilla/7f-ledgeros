import { PageContainer, PageHeader } from '@7f/ui';
import { InventoryReconciliationPanel } from './InventoryReconciliationPanel';

export default function InventoryReconciliationPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Inventory Reconciliation"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Reconciliation' },
        ]}
      />
      <InventoryReconciliationPanel />
    </PageContainer>
  );
}