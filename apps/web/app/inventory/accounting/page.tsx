import { PageContainer, PageHeader } from '@7f/ui';
import { InventoryAccountingConfigForm } from './InventoryAccountingConfigForm';

export default function InventoryAccountingPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Inventory Accounting"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Accounting' },
        ]}
      />
      <InventoryAccountingConfigForm />
    </PageContainer>
  );
}