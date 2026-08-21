import { PageContainer, PageHeader } from '@7f/ui';
import { fetchApi } from '../../lib/api';
import { AdminBrandingForm } from './AdminBrandingForm';

export const dynamic = 'force-dynamic';

export default async function AdminBrandingPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entities = await fetchApi<any[]>('/entities');
  
  // Default to first entity if none selected
  const selectedEntityId = searchParams.entityId || entities[0]?.id;
  
  let profile = null;
  if (selectedEntityId) {
    try {
      profile = await fetchApi<any>('/admin/entities/' + selectedEntityId + '/profile');
    } catch {
      // 404 means no profile yet, which is fine
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Admin Branding & Profiles" />
      {selectedEntityId ? (
        <AdminBrandingForm 
          entities={entities} 
          selectedEntityId={selectedEntityId} 
          initialProfile={profile} 
        />
      ) : (
        <div>No entities available.</div>
      )}
    </PageContainer>
  );
}
