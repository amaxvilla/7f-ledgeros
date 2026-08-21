'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi } from '../../lib/api';

export async function createDirectoryUser(providerCode: string, email: string, firstName: string, lastName: string) {
  await fetchApi('/workspace-admin/users', {
    method: 'POST',
    body: JSON.stringify({ providerCode, email, name: { givenName: firstName, familyName: lastName } })
  });
  revalidatePath('/workspace-admin');
}

export async function suspendDirectoryUser(providerCode: string, providerUserId: string, suspend: boolean) {
  await fetchApi('/workspace-admin/users/' + providerUserId + '/suspend', {
    method: 'POST',
    body: JSON.stringify({ providerCode, suspended: suspend })
  });
  revalidatePath('/workspace-admin');
}

export async function deleteDirectoryUser(providerCode: string, providerUserId: string) {
  await fetchApi('/workspace-admin/users/' + providerUserId, {
    method: 'DELETE',
    body: JSON.stringify({ providerCode })
  });
  revalidatePath('/workspace-admin');
}
