import { PageContainer, PageHeader } from '@7f/ui';
import { fetchApi } from '../../lib/api';
import { TransfersTable } from './TransfersTable';
import { CreateTransferForm } from './CreateTransferForm';

export const dynamic = 'force-dynamic';

export default async function TransfersPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const query = searchParams.entityId ? '?entityId=' + searchParams.entityId : '';
  const [transfers, entities] = await Promise.all([
    fetchApi<any[]>('/transfers' + query),
    fetchApi<any[]>('/entities')
  ]);

  return (
    <PageContainer>
      <PageHeader title="Bank Transfers" />
      <CreateTransferForm entities={entities} />
      <TransfersTable transfers={transfers} entities={entities} />
    </PageContainer>
  );
}
