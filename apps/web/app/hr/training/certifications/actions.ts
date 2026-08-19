'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, fetchApi } from '../../../../lib/api';

export type CertificationActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

function getError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export async function issueCertification(input: {
  employeeId: string;
  trainingEnrollmentId?: string;
  name: string;
  issuedBy?: string;
  issueDate: string;
  expiryDate?: string;
  certificateUrl?: string;
}): Promise<CertificationActionResult> {
  try {
    const data = await fetchApi('/hr/training/certifications', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: input.employeeId,
        trainingEnrollmentId: input.trainingEnrollmentId || undefined,
        name: input.name.trim(),
        issuedBy: input.issuedBy?.trim() || undefined,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate || undefined,
        certificateUrl: input.certificateUrl?.trim() || undefined,
      }),
    });

    revalidatePath('/hr/training');
    revalidatePath('/hr/training/certifications');

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to issue certification.'),
    };
  }
}
