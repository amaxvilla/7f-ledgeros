import { PageContainer, PageHeader } from '@7f/ui';
import { fetchApi } from '../../lib/api';
import { WorkspaceUsersTable } from './WorkspaceUsersTable';
import { CreateWorkspaceUserForm } from './CreateWorkspaceUserForm';

export const dynamic = 'force-dynamic';

export default async function WorkspaceAdminPage({ searchParams }: { searchParams: { providerCode?: string } }) {
  const providerCode = searchParams.providerCode || 'GOOGLE_WORKSPACE';

  const users = await fetchApi<any[]>('/workspace-admin/users?providerCode=' + providerCode);

  return (
    <PageContainer>
      <PageHeader title="Workspace Admin" />
      <CreateWorkspaceUserForm providerCode={providerCode} />
      <WorkspaceUsersTable users={users} providerCode={providerCode} />
    </PageContainer>
  );
}
