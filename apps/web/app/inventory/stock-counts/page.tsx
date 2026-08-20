import { redirect } from 'next/navigation';

export default function StockCountsPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  if (!searchParams.entityId) redirect('/inventory');
  redirect(`/inventory?entityId=${encodeURIComponent(searchParams.entityId)}#stock-counts`);
}
