import { PageContainer, PageHeader } from '@7f/ui';
import { fetchApi } from '../../lib/api';
import { IntercompanyTable } from './IntercompanyTable';
import { CreateIntercompanyForm } from './CreateIntercompanyForm';

export const dynamic = 'force-dynamic';

export default async function IntercompanyPage({ searchParams }: { searchParams: { entityId?: string; status?: string } }) {
  const query = new URLSearchParams();
  if (searchParams.entityId) query.set('entityId', searchParams.entityId);
  if (searchParams.status) query.set('status', searchParams.status);
  
  const [transactions, entitiesResponse] = await Promise.all([
    fetchApi<any[]>('/intercompany?' + query.toString()),
    fetchApi<any[]>('/entities')
  ]);

  return (
    <PageContainer>
      <PageHeader title="Intercompany Transactions" />
      <CreateIntercompanyForm entities={entitiesResponse} />
      <IntercompanyTable transactions={transactions} entities={entitiesResponse} />
    </PageContainer>
  );
}
