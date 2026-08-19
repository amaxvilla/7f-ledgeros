'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ActionState {
  ok: boolean;
  error?: string;
}

/**
 * HR — Attendance frontend actions.
 *
 * Wires the daily attendance workflow plus administrative attendance
 * management: shifts, roster assignments, biometric device registration,
 * raw biometric events, and biometric reconciliation.
 */
export async function clockIn(employeeId: string, timestamp: string): Promise<ActionState> {
  try {
    await fetchApi('/hr/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ employeeId, timestamp }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to clock in.' };
  }

  revalidatePath('/hr/attendance');
  return { ok: true };
}

export async function clockOut(employeeId: string, timestamp: string): Promise<ActionState> {
  try {
    await fetchApi('/hr/attendance/clock-out', {
      method: 'POST',
      body: JSON.stringify({ employeeId, timestamp }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to clock out.' };
  }

  revalidatePath('/hr/attendance');
  return { ok: true };
}

export async function markAbsentees(entityId: string, date: string): Promise<ActionState & { marked?: number }> {
  try {
    const result = await fetchApi<{ marked: number }>('/hr/attendance/mark-absentees', {
      method: 'POST',
      body: JSON.stringify({ entityId, date }),
    });
    revalidatePath('/hr/attendance');
    return { ok: true, marked: result.marked };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark absentees.' };
  }
}
