"use server";

import { revalidatePath } from "next/cache";
import { fetchApi } from "../../lib/api";

type ActionResult = { ok: true } | { ok: false; error: string };

async function run(path: string, init?: RequestInit): Promise<ActionResult> {
  try {
    await fetchApi(path, init);
    revalidatePath("/project-resources");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed.",
    };
  }
}

export async function createResource(input: {
  projectId: string;
  entityId: string;
  type: "LABOUR" | "EQUIPMENT";
  name: string;
  code?: string;
  unitOfMeasure?: string;
  unitCost?: number;
  capacity?: number;
}) {
  return run("/project-resources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deactivateResource(id: string) {
  return run(`/project-resources/${id}/deactivate`, {
    method: "POST",
  });
}

export async function reactivateResource(id: string) {
  return run(`/project-resources/${id}/reactivate`, {
    method: "POST",
  });
}

export async function createAllocation(input: {
  resourceId: string;
  taskId: string;
  entityId: string;
  startDate: string;
  endDate: string;
  plannedQuantity: number;
  notes?: string;
}) {
  return run("/resource-allocations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function startAllocation(id: string) {
  return run(`/resource-allocations/${id}/start`, {
    method: "POST",
  });
}

export async function completeAllocation(
  id: string,
  actualQuantity?: number,
) {
  return run(`/resource-allocations/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(
      actualQuantity === undefined ? {} : { actualQuantity },
    ),
  });
}

export async function cancelAllocation(id: string, reason: string) {
  return run(`/resource-allocations/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
