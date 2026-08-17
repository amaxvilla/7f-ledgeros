"use client";

import * as React from "react";
import { Button, Select, tokens } from "@7f/ui";
import { activateAccountForEntity } from "./actions";

export function ActivateAccountForm({
  accountId,
  entityId,
}: {
  accountId: string;
  entityId: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleActivate() {
    setPending(true);
    setMessage(null);
    setError(null);

    const result = await activateAccountForEntity(entityId, accountId);

    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Failed to activate account.");
      return;
    }

    setMessage("Activated");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.space(2) }}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleActivate}
      >
        {pending ? "Activating..." : message ?? "Activate"}
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
