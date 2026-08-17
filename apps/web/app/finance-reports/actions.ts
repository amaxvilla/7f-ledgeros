'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi } from '../../lib/api';

export async function updateIfrsDisclosure(formData: FormData) {
  const entityId = String(formData.get('entityId') ?? '').trim();
  const fiscalPeriodId = String(formData.get('fiscalPeriodId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const content = String(formData.get('content') ?? '');

  if (!entityId || !fiscalPeriodId || !note) {
    throw new Error('Entity, fiscal period and note are required.');
  }

  await fetchApi(
    `/reporting/ifrs-notes/${encodeURIComponent(note)}/disclosure?entityId=${encodeURIComponent(entityId)}&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ content }),
    },
  );

  revalidatePath('/finance-reports');
}
