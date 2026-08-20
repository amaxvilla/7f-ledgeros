import { redirect } from 'next/navigation';

export default function WarehouseDetailPage({
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
    `/inventory?entityId=${encodeURIComponent(entityId)}&warehouseId=${encodeURIComponent(params.id)}`
  );
}
