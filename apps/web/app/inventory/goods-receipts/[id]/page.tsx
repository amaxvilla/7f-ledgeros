import { redirect } from 'next/navigation';

export default function GoodsReceiptDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { entityId?: string };
}) {
  if (!searchParams.entityId) redirect('/inventory');

  redirect(
    `/inventory?entityId=${encodeURIComponent(searchParams.entityId)}&transactionId=${encodeURIComponent(params.id)}#goods-receipts`
  );
}
