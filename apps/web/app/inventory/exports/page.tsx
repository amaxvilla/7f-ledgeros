import { PageContainer, PageHeader } from '@7f/ui';
import { InventoryExportForm } from './InventoryExportForm';

export default function InventoryExportPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Inventory Export"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Export' },
        ]}
      />
      <InventoryExportForm />
    </PageContainer>
  );
}