import { PageContainer, PageHeader } from '@7f/ui';
import { redirect } from 'next/navigation';

export default function WarehousesPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    redirect('/inventory');
  }

  redirect(`/inventory?entityId=${encodeURIComponent(entityId)}`);
}
