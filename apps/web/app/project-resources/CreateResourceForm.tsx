"use client";

import * as React from "react";
import { Button, Select, TextField, tokens } from "@7f/ui";
import type { SelectOption } from "@7f/ui";
import { createResource } from "./actions";

const TYPE_OPTIONS: SelectOption[] = [
  { value: "LABOUR", label: "Labour" },
  { value: "EQUIPMENT", label: "Equipment" },
];

export function CreateResourceForm({
  entityId,
  projectId,
}: {
  entityId: string;
  projectId: string;
}) {
  const [type, setType] = React.useState("LABOUR");
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [unitOfMeasure, setUnitOfMeasure] = React.useState("");
  const [unitCost, setUnitCost] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createResource({
      projectId,
      entityId,
      type: type as "LABOUR" | "EQUIPMENT",
      name,
      code: code || undefined,
      unitOfMeasure: unitOfMeasure || undefined,
      unitCost: unitCost === "" ? undefined : Number(unitCost),
      capacity: capacity === "" ? undefined : Number(capacity),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setName("");
    setCode("");
    setUnitOfMeasure("");
    setUnitCost("");
    setCapacity("");
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
      <Select
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={TYPE_OPTIONS}
        style={{ minWidth: "150px" }}
      />

      <TextField
        label="Resource name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="e.g. Masonry Crew A"
        style={{ minWidth: "220px" }}
      />

      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Optional"
        style={{ minWidth: "130px" }}
      />

      <TextField
        label="Unit"
        value={unitOfMeasure}
        onChange={(e) => setUnitOfMeasure(e.target.value)}
        placeholder="hours / units"
        style={{ minWidth: "140px" }}
      />

      <TextField
        label="Unit cost"
        type="number"
        min={0}
        step="0.01"
        value={unitCost}
        onChange={(e) => setUnitCost(e.target.value)}
        placeholder="0.00"
        style={{ minWidth: "140px" }}
      />

      <TextField
        label="Capacity"
        type="number"
        min={1}
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        placeholder="Optional"
        style={{ minWidth: "130px" }}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Add resource"}
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
