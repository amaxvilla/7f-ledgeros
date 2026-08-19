'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, fetchApi } from '../../../../lib/api';

export type AttendanceActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function getError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export async function createShift(input: {
  entityId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}): Promise<AttendanceActionResult> {
  try {
    const data = await fetchApi('/hr/attendance/shifts', {
      method: 'POST',
      body: JSON.stringify({
        entityId: input.entityId,
        code: input.code.trim(),
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes ?? 0,
      }),
    });

    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance/management');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to create shift.'),
    };
  }
}

export async function assignShift(input: {
  employeeId: string;
  shiftId: string;
  date: string;
}): Promise<AttendanceActionResult> {
  try {
    const data = await fetchApi('/hr/attendance/roster', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance/management');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to assign shift.'),
    };
  }
}

export async function registerBiometricDevice(input: {
  entityId: string;
  name: string;
  location?: string;
  deviceIdentifier: string;
}): Promise<AttendanceActionResult> {
  try {
    const data = await fetchApi('/hr/attendance/biometric/devices', {
      method: 'POST',
      body: JSON.stringify({
        entityId: input.entityId,
        name: input.name.trim(),
        location: input.location?.trim() || undefined,
        deviceIdentifier: input.deviceIdentifier.trim(),
      }),
    });

    revalidatePath('/hr/attendance/management');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to register biometric device.'),
    };
  }
}

export async function pushBiometricEvent(input: {
  deviceId: string;
  rawEmployeeCode: string;
  eventType: 'CLOCK_IN' | 'CLOCK_OUT';
  eventTime: string;
}): Promise<AttendanceActionResult> {
  try {
    const data = await fetchApi('/hr/attendance/biometric/events', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/hr/attendance/management');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to record biometric event.'),
    };
  }
}

export async function reconcileBiometricEvents(
  entityId: string,
): Promise<AttendanceActionResult> {
  try {
    const data = await fetchApi('/hr/attendance/biometric/reconcile', {
      method: 'POST',
      body: JSON.stringify({ entityId }),
    });

    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance/management');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to reconcile biometric events.'),
    };
  }
}
