'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ActionState {
  ok: boolean;
  error?: string;
}

/**
 * HR — Performance frontend actions.
 *
 * Covers performance-cycle workflow, review workflow, goals/OKRs, KPIs,
 * competency catalog management, and competency assessments.
 */
export async function createCycle(input: {
  entityId: string;
  name: string;
  startDate: string;
  endDate: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/cycles', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create cycle.' };
  }

  revalidatePath('/hr/performance');
  return { ok: true };
}

export async function startCalibration(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/cycles/${id}/start-calibration`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start calibration.' };
  }

  revalidatePath('/hr/performance');
  return { ok: true };
}

export async function closeCycle(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/cycles/${id}/close`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to close cycle.' };
  }

  revalidatePath('/hr/performance');
  return { ok: true };
}

export async function submitSelfAssessment(input: {
  employeeId: string;
  cycleId: string;
  selfRating: number;
  selfComments?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/reviews/self-assessment', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit self-assessment.' };
  }

  revalidatePath('/hr/performance');
  return { ok: true };
}

export async function submitManagerReview(
  id: string,
  input: { managerRating: number; managerComments?: string; promotionRecommended?: boolean; pipRequired?: boolean },
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/reviews/${id}/manager-review`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit manager review.' };
  }

  revalidatePath(`/hr/performance/${id}`);
  return { ok: true };
}

export async function addPeerFeedback(id: string, comments: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/reviews/${id}/peer-feedback`, { method: 'POST', body: JSON.stringify({ comments }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to add peer feedback.' };
  }

  revalidatePath(`/hr/performance/${id}`);
  return { ok: true };
}

export async function calibrateReview(id: string, calibratedRating: number): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/reviews/${id}/calibrate`, { method: 'POST', body: JSON.stringify({ calibratedRating }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to calibrate review.' };
  }

  revalidatePath(`/hr/performance/${id}`);
  return { ok: true };
}

export async function completeReview(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/reviews/${id}/complete`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to complete review.' };
  }

  revalidatePath(`/hr/performance/${id}`);
  revalidatePath('/hr/performance');
  return { ok: true };
}

export async function createPerformanceGoal(input: {
  employeeId: string;
  cycleId?: string;
  title: string;
  description?: string;
  weight?: number;
  targetDate?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/goals', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        cycleId: input.cycleId || undefined,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        weight: input.weight,
        targetDate: input.targetDate || undefined,
      }),
    });
    revalidatePath('/hr/performance');
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to create goal.',
    };
  }
}

export async function updatePerformanceGoalProgress(
  id: string,
  progressPercent: number,
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/goals/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progressPercent }),
    });
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to update goal progress.',
    };
  }
}

export async function createPerformanceKpi(input: {
  employeeId: string;
  cycleId?: string;
  name: string;
  targetValue: number;
  unit?: string;
  weight?: number;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/kpis', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        cycleId: input.cycleId || undefined,
        name: input.name.trim(),
        targetValue: input.targetValue,
        unit: input.unit?.trim() || undefined,
        weight: input.weight,
      }),
    });
    revalidatePath('/hr/performance');
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to create KPI.',
    };
  }
}

export async function updatePerformanceKpiActual(
  id: string,
  actualValue: number,
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/performance/kpis/${id}/actual`, {
      method: 'POST',
      body: JSON.stringify({ actualValue }),
    });
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to update KPI actual value.',
    };
  }
}

export async function createPerformanceCompetency(input: {
  name: string;
  description?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/competencies', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
      }),
    });
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to create competency.',
    };
  }
}

export async function assessEmployeeCompetency(input: {
  employeeId: string;
  competencyId: string;
  cycleId?: string;
  rating: number;
  comments?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/performance/competency-assessments', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        competencyId: input.competencyId,
        cycleId: input.cycleId || undefined,
        rating: input.rating,
        comments: input.comments?.trim() || undefined,
      }),
    });
    revalidatePath('/hr/performance/management');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to record competency assessment.',
    };
  }
}
