import { redirect } from 'next/navigation';

export default function StockItemsPage({
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
