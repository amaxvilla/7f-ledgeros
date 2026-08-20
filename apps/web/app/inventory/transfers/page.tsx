import { redirect } from 'next/navigation';

export default function TransfersPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  if (!searchParams.entityId) redirect('/inventory');
  redirect(`/inventory?entityId=${encodeURIComponent(searchParams.entityId)}#stock-transfers`);
}
