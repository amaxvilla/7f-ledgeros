"use client";

import * as React from "react";
import {
  Button,
  Select,
  TextField,
  tokens,
} from "@7f/ui";
import type { SelectOption } from "@7f/ui";
import { createAccount } from "./actions";

const ACCOUNT_TYPES: SelectOption[] = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

const ACCOUNT_CATEGORIES: SelectOption[] = [
  { value: "CURRENT_ASSET", label: "Current Asset" },
  { value: "NON_CURRENT_ASSET", label: "Non-current Asset" },
  { value: "CURRENT_LIABILITY", label: "Current Liability" },
  { value: "NON_CURRENT_LIABILITY", label: "Non-current Liability" },
  { value: "SHARE_CAPITAL", label: "Share Capital" },
  { value: "RETAINED_EARNINGS", label: "Retained Earnings" },
  { value: "OTHER_EQUITY", label: "Other Equity" },
  { value: "OPERATING_REVENUE", label: "Operating Revenue" },
  { value: "OTHER_REVENUE", label: "Other Revenue" },
  { value: "COST_OF_SALES", label: "Cost of Sales" },
  { value: "OPERATING_EXPENSE", label: "Operating Expense" },
  { value: "FINANCE_EXPENSE", label: "Finance Expense" },
  { value: "TAX_EXPENSE", label: "Tax Expense" },
];

const BOOLEAN_OPTIONS: SelectOption[] = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

export function CreateAccountForm({
  parentOptions,
}: {
  parentOptions: SelectOption[];
}) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [accountType, setAccountType] = React.useState("");
  const [accountCategory, setAccountCategory] = React.useState("");
  const [ifrsMapping, setIfrsMapping] = React.useState("");
  const [isControlAccount, setIsControlAccount] = React.useState("false");
  const [isPostable, setIsPostable] = React.useState("true");
  const [parentAccountId, setParentAccountId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setPending(true);
    setError(null);

    const result = await createAccount({
      code: code.trim(),
      name: name.trim(),
      accountType,
      accountCategory,
      ifrsMapping: ifrsMapping.trim() || undefined,
      isControlAccount: isControlAccount === "true",
      isPostable: isPostable === "true",
      parentAccountId: parentAccountId || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Failed to create account.");
      return;
    }

    setCode("");
    setName("");
    setAccountType("");
    setAccountCategory("");
    setIfrsMapping("");
    setIsControlAccount("false");
    setIsPostable("true");
    setParentAccountId("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.space(3),
        alignItems: "flex-end",
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. 4100"
        required
        style={{ minWidth: "120px" }}
      />

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Account name"
        required
        style={{ minWidth: "220px" }}
      />

      <Select
        label="Account type"
        value={accountType}
        onChange={(e) => setAccountType(e.target.value)}
        options={ACCOUNT_TYPES}
        placeholder="Select type"
        required
        style={{ minWidth: "180px" }}
      />

      <Select
        label="Category"
        value={accountCategory}
        onChange={(e) => setAccountCategory(e.target.value)}
        options={ACCOUNT_CATEGORIES}
        placeholder="Select category"
        required
        style={{ minWidth: "210px" }}
      />

      <TextField
        label="IFRS mapping"
        value={ifrsMapping}
        onChange={(e) => setIfrsMapping(e.target.value)}
        placeholder="Optional"
        style={{ minWidth: "190px" }}
      />

      <Select
        label="Control account"
        value={isControlAccount}
        onChange={(e) => setIsControlAccount(e.target.value)}
        options={BOOLEAN_OPTIONS}
        style={{ minWidth: "150px" }}
      />

      <Select
        label="Postable"
        value={isPostable}
        onChange={(e) => setIsPostable(e.target.value)}
        options={BOOLEAN_OPTIONS}
        style={{ minWidth: "120px" }}
      />

      <Select
        label="Parent account"
        value={parentAccountId}
        onChange={(e) => setParentAccountId(e.target.value)}
        options={parentOptions}
        placeholder="No parent"
        style={{ minWidth: "220px" }}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create account"}
      </Button>

      {error && (
        <div
          style={{
            width: "100%",
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
