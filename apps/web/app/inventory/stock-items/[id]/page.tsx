import { redirect } from 'next/navigation';

export default function StockItemDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    redirect('/inventory');
  }

  redirect(
    `/inventory?entityId=${encodeURIComponent(entityId)}&stockItemId=${encodeURIComponent(params.id)}`
  );
}
