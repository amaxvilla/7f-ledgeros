import {
  Badge,
  DataTable,
  PageContainer,
  PageHeader,
  Select,
  tokens,
} from "@7f/ui";
import type { SelectOption } from "@7f/ui";
import { fetchApi, ApiError } from "../../lib/api";
import { EntitySelector } from "../EntitySelector";
import { CreateAccountForm } from "./CreateAccountForm";
import { ActivateAccountForm } from "./ActivateAccountForm";
import { AccountActions } from "./AccountActions";

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

const ACCOUNT_TYPES: SelectOption[] = [
  { value: "", label: "All account types" },
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

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
        <Select
          label="Account type"
          value={accountType}
          options={ACCOUNT_TYPES}
          onChange={() => undefined}
        />
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
          <DataTable
            columns={[
              {
                header: "Code",
                render: (a: Account) => a.code,
              },
              {
                header: "Name",
                render: (a: Account) => a.name,
              },
              {
                header: "Type",
                render: (a: Account) => a.accountType,
              },
              {
                header: "Category",
                render: (a: Account) => a.accountCategory,
              },
              {
                header: "Action",
                align: "right",
                render: (a: Account) =>
                  a.isActive ? (
                    <ActivateAccountForm
                      accountId={a.id}
                      entityId={entityId}
                    />
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  ),
              },
            ]}
            rows={accounts}
            keyOf={(a) => `entity-${a.id}`}
            emptyMessage="No accounts available for activation."
            search={{
              getText: (a) => `${a.code} ${a.name} ${a.accountCategory}`,
              placeholder: "Search accounts...",
            }}
          />
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
          <DataTable
            columns={[
              {
                header: "Code",
                render: (a: Account) => a.code,
              },
              {
                header: "Name",
                render: (a: Account) => a.name,
              },
              {
                header: "Type",
                render: (a: Account) => a.accountType,
              },
              {
                header: "Category",
                render: (a: Account) => a.accountCategory,
              },
              {
                header: "Parent",
                render: (a: Account) =>
                  a.parentAccount
                    ? `${a.parentAccount.code} — ${a.parentAccount.name}`
                    : "—",
              },
              {
                header: "Postable",
                render: (a: Account) => (
                  <Badge tone={a.isPostable ? "positive" : "neutral"}>
                    {a.isPostable ? "Yes" : "No"}
                  </Badge>
                ),
              },
              {
                header: "Status",
                render: (a: Account) => (
                  <Badge tone={a.isActive ? "positive" : "neutral"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              {
                header: "Actions",
                align: "right",
                render: (a: Account) => (
                  <AccountActions id={a.id} isActive={a.isActive} />
                ),
              },
            ]}
            rows={accounts}
            keyOf={(a) => a.id}
            emptyMessage="No accounts configured yet."
            search={{
              getText: (a) =>
                `${a.code} ${a.name} ${a.accountType} ${a.accountCategory} ${a.ifrsMapping ?? ""}`,
              placeholder: "Search by code, name, type or category...",
            }}
          />
        )}
      </section>
    </PageContainer>
  );
}
