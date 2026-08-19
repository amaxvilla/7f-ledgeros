'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ActionState {
  ok: boolean;
  error?: string;
}

/**
 * HR — Leave frontend actions.
 *
 * Covers leave requests and the administrative leave workflow including
 * leave types, balance initialization, and public-holiday management.
 * Leave calendar and balance views are rendered by the leave page.
 */
export async function requestLeave(input: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/leave/requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason || undefined,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit leave request.' };
  }

  revalidatePath('/hr/leave');
  return { ok: true };
}

export async function approveLeaveRequest(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/leave/requests/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve leave request.' };
  }

  revalidatePath('/hr/leave');
  return { ok: true };
}

export async function rejectLeaveRequest(id: string, rejectionReason: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/leave/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject leave request.' };
  }

  revalidatePath('/hr/leave');
  return { ok: true };
}

export async function cancelLeaveRequest(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/leave/requests/${id}/cancel`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel leave request.' };
  }

  revalidatePath('/hr/leave');
  return { ok: true };
}
