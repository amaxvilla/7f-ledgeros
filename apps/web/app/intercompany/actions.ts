'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi } from '../../lib/api';

export async function createIntercompany(
  initiatorEntityId: string,
  counterpartyEntityId: string,
  initiatorAccountCode: string,
  counterpartyAccountCode: string,
  amount: number,
  currency: string,
  description: string,
) {
  await fetchApi('/intercompany', {
    method: 'POST',
    body: JSON.stringify({
      initiatorEntityId,
      counterpartyEntityId,
      initiatorAccountCode,
      counterpartyAccountCode,
      amount,
      currency,
      description,
    }),
  });
  revalidatePath('/intercompany');
}

export async function reconcileIntercompany(id: string) {
  await fetchApi(`/intercompany/${id}/reconcile`, { method: 'POST' });
  revalidatePath('/intercompany');
}

export async function disputeIntercompany(id: string) {
  await fetchApi(`/intercompany/${id}/dispute`, { method: 'POST' });
  revalidatePath('/intercompany');
}
