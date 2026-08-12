'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CommissionCalculationActionState {
  ok: boolean;
  error?: string;
}

/**
 * Agent & Commission Management, RE-COMM.2 (frontend) — Commission
 * Calculation. Verified before building: `CommissionCalculationController`
 * has no frontend consumer anywhere in this app — confirmed by grepping
 * every `app/**\/*.tsx` for `/commission-calculations` first.
 */
export async function calculateCommission(input: {
  agentAssignmentId: string;
  basisType: 'GROSS' | 'NET';
  discountAmount?: number;
  collectionBasis?: 'FULL' | 'COLLECTED';
  whtTaxCodeId?: string;
  notes?: string;
}): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi('/commission-calculations', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to calculate commission.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function cancelCommissionCalculation(id: string, reason: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel commission calculation.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function reverseCommissionCalculation(id: string, reason: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reverse commission calculation.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function submitCommissionCalculation(id: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/submit`, { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit commission calculation for approval.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function approveCommissionCalculation(id: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve commission calculation.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function rejectCommissionCalculation(id: string, reason: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject commission calculation.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function markCommissionCalculationPayable(
  id: string,
  commissionExpenseAccountId: string,
  commissionPayableAccountId: string,
): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/mark-payable`, {
      method: 'POST',
      body: JSON.stringify({ commissionExpenseAccountId, commissionPayableAccountId }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark commission calculation payable.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}

export async function markCommissionCalculationPaid(id: string, cashAccountId: string, paymentReference: string): Promise<CommissionCalculationActionState> {
  try {
    await fetchApi(`/commission-calculations/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({ cashAccountId, paymentReference }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark commission calculation paid.' };
  }
  revalidatePath('/commission-calculations');
  return { ok: true };
}
