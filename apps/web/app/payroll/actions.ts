'use server';

import { fetchApi, ApiError } from '../../lib/api';

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function getError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export async function createPayrollRun(
  entityId: string,
  payPeriodName: string,
  payPeriodStart: string,
  payPeriodEnd: string,
): Promise<ActionResult> {
  try {
    const data = await fetchApi('/hr/payroll-runs', {
      method: 'POST',
      body: JSON.stringify({
        entityId,
        payPeriodName,
        payPeriodStart,
        payPeriodEnd,
      }),
    });

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to create payroll run.'),
    };
  }
}

export async function calculatePayrollRun(
  payrollRunId: string,
): Promise<ActionResult> {
  try {
    const data = await fetchApi(`/hr/payroll-runs/${payrollRunId}/calculate`, {
      method: 'POST',
    });

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to calculate payroll run.'),
    };
  }
}

export async function approvePayrollRun(
  payrollRunId: string,
): Promise<ActionResult> {
  try {
    const data = await fetchApi(`/hr/payroll-runs/${payrollRunId}/approve`, {
      method: 'POST',
    });

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to approve payroll run.'),
    };
  }
}

export interface PostPayrollInput {
  payrollRunId: string;
  entityId: string;
  entryDate: string;
  salaryExpenseGlId: string;
  employerPensionExpenseGlId: string;
  payePayableGlId: string;
  pensionPayableGlId: string;
  nhfPayableGlId: string;
  netSalariesPayableGlId: string;
  otherDeductionsPayableGlId?: string;
}

export async function postPayrollRun(
  input: PostPayrollInput,
): Promise<ActionResult> {
  try {
    const data = await fetchApi(
      `/hr/payroll-runs/${input.payrollRunId}/post`,
      {
        method: 'POST',
        body: JSON.stringify({
          entityId: input.entityId,
          entryDate: input.entryDate,
          salaryExpenseGlId: input.salaryExpenseGlId,
          employerPensionExpenseGlId: input.employerPensionExpenseGlId,
          payePayableGlId: input.payePayableGlId,
          pensionPayableGlId: input.pensionPayableGlId,
          nhfPayableGlId: input.nhfPayableGlId,
          netSalariesPayableGlId: input.netSalariesPayableGlId,
          ...(input.otherDeductionsPayableGlId
            ? { otherDeductionsPayableGlId: input.otherDeductionsPayableGlId }
            : {}),
        }),
      },
    );

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: getError(error, 'Failed to post payroll run.'),
    };
  }
}
