'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ActionState {
  ok: boolean;
  error?: string;
}

/**
 * HR — Training frontend actions.
 *
 * Covers courses, sessions, enrolment/evaluation workflow, certification
 * issuance, renewal visibility, and the entity skills-matrix views.
 */
export async function createCourse(input: {
  entityId: string;
  code: string;
  name: string;
  durationHours?: number;
  provider?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/training/courses', {
      method: 'POST',
      body: JSON.stringify({
        entityId: input.entityId,
        code: input.code,
        name: input.name,
        durationHours: input.durationHours || undefined,
        provider: input.provider || undefined,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create course.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}

export async function createSession(input: {
  courseId: string;
  startDate: string;
  endDate: string;
  location?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/training/sessions', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to schedule session.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}

export async function enrol(sessionId: string, employeeId: string): Promise<ActionState> {
  try {
    await fetchApi('/hr/training/enrol', { method: 'POST', body: JSON.stringify({ sessionId, employeeId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to enrol employee.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}

export async function markAttended(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/training/enrollments/${id}/attended`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark attended.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}

export async function cancelEnrollment(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/training/enrollments/${id}/cancel`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel enrollment.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}

export async function evaluateTraining(
  id: string,
  input: { evaluationRating: number; evaluationComments?: string; completionScore?: number },
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/training/enrollments/${id}/evaluate`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record evaluation.' };
  }

  revalidatePath('/hr/training');
  return { ok: true };
}
