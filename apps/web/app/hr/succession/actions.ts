'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export async function createSuccessionPlan(input: {
  entityId: string;
  positionTitle: string;
  incumbentEmployeeId?: string;
  criticality?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const data = await fetchApi('/hr/succession/plans', {
      method: 'POST',
      body: JSON.stringify({
        entityId: input.entityId,
        positionTitle: input.positionTitle,
        incumbentEmployeeId: input.incumbentEmployeeId || undefined,
        criticality: input.criticality || undefined,
        notes: input.notes || undefined,
      }),
    });

    revalidatePath('/hr/succession');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: message(error, 'Failed to create succession plan.') };
  }
}

export async function addSuccessionCandidate(input: {
  successionPlanId: string;
  employeeId: string;
  readiness?: string;
  isHighPotential?: boolean;
  developmentNotes?: string;
}): Promise<ActionResult> {
  try {
    const data = await fetchApi('/hr/succession/candidates', {
      method: 'POST',
      body: JSON.stringify({
        successionPlanId: input.successionPlanId,
        employeeId: input.employeeId,
        readiness: input.readiness || undefined,
        isHighPotential: input.isHighPotential ?? false,
        developmentNotes: input.developmentNotes || undefined,
      }),
    });

    revalidatePath('/hr/succession');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: message(error, 'Failed to add succession candidate.') };
  }
}

export async function updateSuccessionReadiness(
  candidateId: string,
  readiness: string,
  developmentNotes?: string,
): Promise<ActionResult> {
  try {
    const data = await fetchApi(
      `/hr/succession/candidates/${candidateId}/readiness`,
      {
        method: 'POST',
        body: JSON.stringify({
          readiness,
          developmentNotes: developmentNotes || undefined,
        }),
      },
    );

    revalidatePath('/hr/succession');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: message(error, 'Failed to update candidate readiness.'),
    };
  }
}
