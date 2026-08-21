import { PageContainer, PageHeader } from '@7f/ui';
import { InventoryImportForm } from './InventoryImportForm';

export default function InventoryImportPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Inventory Import"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Import' },
        ]}
      />
      <InventoryImportForm />
    </PageContainer>
  );
}