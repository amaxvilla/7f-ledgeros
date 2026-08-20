import { redirect } from 'next/navigation';

export default function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  if (!searchParams.entityId) redirect('/inventory');
  redirect(`/inventory?entityId=${encodeURIComponent(searchParams.entityId)}#goods-receipts`);
}
