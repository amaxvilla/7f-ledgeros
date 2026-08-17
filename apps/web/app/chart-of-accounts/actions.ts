"use server";

import { revalidatePath } from "next/cache";
import { ApiError, fetchApi } from "../../lib/api";

export interface CreateAccountInput {
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  ifrsMapping?: string;
  isControlAccount?: boolean;
  isPostable?: boolean;
  parentAccountId?: string;
}

export async function createAccount(input: CreateAccountInput) {
  try {
    await fetchApi("/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    });

    revalidatePath("/chart-of-accounts");
    revalidatePath("/general-ledger");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to create account.",
    };
  }
}

export async function deactivateAccount(id: string) {
  try {
    await fetchApi(`/accounts/${id}`, {
      method: "DELETE",
    });

    revalidatePath("/chart-of-accounts");
    revalidatePath("/general-ledger");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to deactivate account.",
    };
  }
}

export async function activateAccountForEntity(
  entityId: string,
  accountId: string,
) {
  try {
    await fetchApi("/accounts/activate-for-entity", {
      method: "POST",
      body: JSON.stringify({
        entityId,
        accountId,
      }),
    });

    revalidatePath("/chart-of-accounts");
    revalidatePath("/general-ledger");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to activate account for entity.",
    };
  }
}
