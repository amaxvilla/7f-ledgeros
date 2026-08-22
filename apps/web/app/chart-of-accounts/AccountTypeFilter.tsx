"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@7f/ui";
import type { SelectOption } from "@7f/ui";

const ACCOUNT_TYPES: SelectOption[] = [
  { value: "", label: "All account types" },
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

export function AccountTypeFilter({
  initialValue,
}: {
  initialValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("accountType", val);
    } else {
      params.delete("accountType");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      label="Account type"
      value={initialValue}
      options={ACCOUNT_TYPES}
      onChange={handleChange}
    />
  );
}
