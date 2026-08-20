import { redirect } from 'next/navigation';

export default function MaterialIssuesPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  if (!searchParams.entityId) redirect('/inventory');
  redirect(`/inventory?entityId=${encodeURIComponent(searchParams.entityId)}#material-issues`);
}
