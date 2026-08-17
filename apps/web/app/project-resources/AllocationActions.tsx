"use client";

import * as React from "react";
import { Button, tokens } from "@7f/ui";
import {
  cancelAllocation,
  completeAllocation,
  startAllocation,
} from "./actions";

export function AllocationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    setError(null);

    const result = await fn();

    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Action failed.");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.space(2),
        justifyContent: "flex-end",
      }}
    >
      {status === "PLANNED" && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => act(() => startAllocation(id))}
        >
          Start
        </Button>
      )}

      {(status === "PLANNED" || status === "ACTIVE") && (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => act(() => completeAllocation(id))}
          >
            Complete
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Cancellation reason");
              if (reason?.trim()) {
                void act(() => cancelAllocation(id, reason.trim()));
              }
            }}
          >
            Cancel
          </Button>
        </>
      )}

      {error && (
        <span
          style={{
            width: "100%",
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
