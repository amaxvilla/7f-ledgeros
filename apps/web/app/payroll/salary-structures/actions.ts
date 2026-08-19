'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, fetchApi } from '../../../lib/api';

export type SalaryActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

export async function updateSalaryStructure(input: {
  id: string;
  code?: string;
  name?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
}): Promise<SalaryActionResult> {
  try {
    const data = await fetchApi(`/hr/salary-structures/${input.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        code: input.code?.trim() || undefined,
        name: input.name?.trim() || undefined,
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance,
        transportAllowance: input.transportAllowance,
        otherAllowances: input.otherAllowances,
      }),
    });

    revalidatePath('/payroll');
    revalidatePath('/payroll/salary-structures');

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ApiError
          ? error.message
          : 'Failed to update salary structure.',
    };
  }
}
