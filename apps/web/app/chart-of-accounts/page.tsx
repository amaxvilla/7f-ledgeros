import { PageContainer, PageHeader, Select, tokens } from "@7f/ui";
import type { SelectOption } from "@7f/ui";
import { fetchApi, ApiError } from "../../lib/api";
import { EntitySelector } from "../EntitySelector";
import { CreateAccountForm } from "./CreateAccountForm";
import { ActivateAccountForm } from "./ActivateAccountForm";
import { AccountActions } from "./AccountActions";
import { EntityAccountActivationTable, AccountRegisterTable } from "./ChartOfAccountsTables";

export const dynamic = "force-dynamic";

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  ifrsMapping?: string | null;
  isControlAccount?: boolean;
  isPostable?: boolean;
  isActive: boolean;
  parentAccountId?: string | null;
  parentAccount?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

import { AccountTypeFilter } from "./AccountTypeFilter";

async function loadAccounts(accountType?: string) {
  const suffix = accountType
    ? `?accountType=${encodeURIComponent(accountType)}`
    : "?activeOnly=false";

  return fetchApi<Account[]>(`/accounts${suffix}`);
}

export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: {
    entityId?: string;
    accountType?: string;
  };
}) {
  const entityId = searchParams.entityId;
  const accountType = searchParams.accountType ?? "";

  let accounts: Account[] | null = null;
  let error: string | null = null;

  try {
    accounts = await loadAccounts(accountType || undefined);
  } catch (e) {
    error =
      e instanceof ApiError
        ? e.message
        : "Failed to load chart of accounts.";
  }

  const parentOptions: SelectOption[] = [
    ...((accounts ?? []).map((account) => ({
      value: account.id,
      label: `${account.code} — ${account.name}`,
    }))),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Group-wide account master with entity-level activation for posting."
      />

      <section
        style={{
          marginBottom: tokens.space(8),
          display: "grid",
          gridTemplateColumns: "minmax(260px, 420px)",
          gap: tokens.space(4),
        }}
      >
        <AccountTypeFilter initialValue={accountType} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader
          title="Create account"
          subtitle="Accounts belong to the shared group chart."
        />
        <CreateAccountForm parentOptions={parentOptions} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader
          title="Entity activation"
          subtitle={
            entityId
              ? `Selected entity: ${entityId}`
              : "Enter an entity ID to activate accounts for that entity."
          }
        />

        <EntitySelector initialValue={entityId} />

        {entityId && accounts && (
          <EntityAccountActivationTable rows={accounts} entityId={entityId} />
        )}
      </section>

      <section>
        <PageHeader
          title="Account register"
          subtitle="Shared chart used across all entities."
        />

        {error && (
          <div
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
              marginBottom: tokens.space(4),
            }}
          >
            {error}
          </div>
        )}

        {accounts && (
          <AccountRegisterTable rows={accounts} />
        )}
      </section>
    </PageContainer>
  );
}
