"use client";

import * as React from "react";
import { Button, tokens } from "@7f/ui";
import { deactivateAccount } from "./actions";

export function AccountActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDeactivate() {
    setPending(true);
    setError(null);

    const result = await deactivateAccount(id);

    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Failed to deactivate account.");
    }
  }

  if (!isActive) {
    return (
      <span
        style={{
          fontFamily: tokens.font.body,
          fontSize: "12px",
          color: tokens.color.textMuted,
        }}
      >
        Inactive
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleDeactivate}
      >
        {pending ? "Deactivating..." : "Deactivate"}
      </Button>

      {error && (
        <span
          style={{
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            fontSize: "11px",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
