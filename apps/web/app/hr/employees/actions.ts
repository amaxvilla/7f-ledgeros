'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ActionState {
  ok: boolean;
  error?: string;
}

/**
 * Employee frontend actions covering the employee master record and the
 * lifecycle surfaces: confirmation, onboarding, exit/clearance, documents,
 * next of kin, emergency contacts, asset assignment/return, and
 * disciplinary case management.
 */
export async function createEmployee(input: {
  entityId: string;
  departmentId?: string;
  salaryStructureId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees', {
      method: 'POST',
      body: JSON.stringify({
        entityId: input.entityId,
        departmentId: input.departmentId || undefined,
        salaryStructureId: input.salaryStructureId || undefined,
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create employee.' };
  }

  revalidatePath('/hr/employees');
  return { ok: true };
}

export async function confirmEmployee(id: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/employees/${id}/confirm`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to confirm employee.' };
  }

  revalidatePath(`/hr/employees/${id}`);
  revalidatePath('/hr/employees');
  return { ok: true };
}

export async function startOnboarding(id: string, dueDate?: string): Promise<ActionState> {
  try {
    const qs = dueDate ? `?dueDate=${encodeURIComponent(dueDate)}` : '';
    await fetchApi(`/hr/employees/${id}/onboarding/start${qs}`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start onboarding.' };
  }

  revalidatePath(`/hr/employees/${id}`);
  return { ok: true };
}

export async function completeOnboardingTask(taskId: string, employeeId: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/employees/onboarding/tasks/${taskId}/complete`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to complete task.' };
  }

  revalidatePath(`/hr/employees/${employeeId}`);
  return { ok: true };
}

export async function initiateExit(input: {
  employeeId: string;
  exitType: string;
  noticeDate: string;
  lastWorkingDate: string;
  reason?: string;
  clearanceChecklist: Record<string, string[]>;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/exits', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        exitType: input.exitType,
        noticeDate: input.noticeDate,
        lastWorkingDate: input.lastWorkingDate,
        reason: input.reason || undefined,
        clearanceChecklist: input.clearanceChecklist,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to initiate exit.' };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  revalidatePath('/hr/employees');
  return { ok: true };
}

export async function clearExitItem(itemId: string, employeeId: string, remarks?: string): Promise<ActionState> {
  try {
    await fetchApi(`/hr/employees/exits/clearance-items/${itemId}/clear`, {
      method: 'POST',
      body: JSON.stringify({ remarks: remarks || undefined }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to clear item.' };
  }

  revalidatePath(`/hr/employees/${employeeId}`);
  return { ok: true };
}

export async function addEmployeeDocument(input: {
  employeeId: string;
  documentType: string;
  fileUrl: string;
  description?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/documents', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        documentType: input.documentType,
        fileUrl: input.fileUrl,
        description: input.description || undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to attach document.',
    };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  return { ok: true };
}

export async function addEmployeeNextOfKin(input: {
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/next-of-kin', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        name: input.name,
        relationship: input.relationship,
        phone: input.phone,
        address: input.address || undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to add next of kin.',
    };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  return { ok: true };
}

export async function addEmployeeEmergencyContact(input: {
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        name: input.name,
        relationship: input.relationship,
        phone: input.phone,
        address: input.address || undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to add emergency contact.',
    };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  return { ok: true };
}

export async function assignEmployeeAsset(input: {
  employeeId: string;
  assetName: string;
  assetTag?: string;
  description?: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/assets', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        assetName: input.assetName,
        assetTag: input.assetTag || undefined,
        description: input.description || undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to assign asset.',
    };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  return { ok: true };
}

export async function returnEmployeeAsset(
  assignmentId: string,
  employeeId: string,
  condition?: string,
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/employees/assets/${assignmentId}/return`, {
      method: 'POST',
      body: JSON.stringify({
        condition: condition || undefined,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : 'Failed to return asset.',
    };
  }

  revalidatePath(`/hr/employees/${employeeId}`);
  return { ok: true };
}

export async function raiseEmployeeDisciplinaryCase(input: {
  employeeId: string;
  caseType: string;
  description: string;
}): Promise<ActionState> {
  try {
    await fetchApi('/hr/employees/disciplinary-cases', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        caseType: input.caseType,
        description: input.description,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError
        ? e.message
        : 'Failed to raise disciplinary case.',
    };
  }

  revalidatePath(`/hr/employees/${input.employeeId}`);
  return { ok: true };
}

export async function closeEmployeeDisciplinaryCase(
  caseId: string,
  employeeId: string,
  outcome: string,
): Promise<ActionState> {
  try {
    await fetchApi(`/hr/employees/disciplinary-cases/${caseId}/close`, {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError
        ? e.message
        : 'Failed to close disciplinary case.',
    };
  }

  revalidatePath(`/hr/employees/${employeeId}`);
  return { ok: true };
}
