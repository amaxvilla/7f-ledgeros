'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi } from '../../lib/api';

export async function createBankTransfer(
  providerCode: string,
  entityId: string,
  reference: string,
  amount: number,
  currency: string,
  destinationBankCode: string,
  destinationAccountNumber: string,
  narration?: string
) {
  await fetchApi('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      providerCode,
      entityId,
      reference,
      amount,
      currency,
      destinationBankCode,
      destinationAccountNumber,
      narration
    }),
  });
  revalidatePath('/transfers');
}

export async function initiateTransfer(id: string) {
  await fetchApi('/transfers/' + id + '/initiate', { method: 'POST' });
  revalidatePath('/transfers');
}

export async function verifyTransfer(id: string) {
  await fetchApi('/transfers/' + id + '/verify', { method: 'POST' });
  revalidatePath('/transfers');
}
