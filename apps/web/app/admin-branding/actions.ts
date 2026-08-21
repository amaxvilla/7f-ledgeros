'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi } from '../../lib/api';

export async function updateEntityProfile(
  entityId: string,
  primaryColor?: string,
  secondaryColor?: string,
  logoFileId?: string
) {
  await fetchApi('/admin/entities/' + entityId + '/profile', {
    method: 'PUT',
    body: JSON.stringify({
      themePrimaryColor: primaryColor,
      themeSecondaryColor: secondaryColor,
      logoBrandAssetId: logoFileId,
    }),
  });
  revalidatePath('/admin-branding');
}
