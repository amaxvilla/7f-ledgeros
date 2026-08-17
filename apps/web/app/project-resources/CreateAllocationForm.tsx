"use client";

import * as React from "react";
import { Button, TextField, tokens } from "@7f/ui";
import type { SelectOption } from "@7f/ui";
import { createAllocation } from "./actions";

export function CreateAllocationForm({
  entityId,
  resources,
  tasks,
}: {
  entityId: string;
  resources: SelectOption[];
  tasks: SelectOption[];
}) {
  const [resourceId, setResourceId] = React.useState("");
  const [taskId, setTaskId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [plannedQuantity, setPlannedQuantity] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createAllocation({
      resourceId,
      taskId,
      entityId,
      startDate,
      endDate,
      plannedQuantity: Number(plannedQuantity),
      notes: notes || undefined,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setResourceId("");
    setTaskId("");
    setStartDate("");
    setEndDate("");
    setPlannedQuantity("");
    setNotes("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: tokens.space(3),
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <label style={{ display: "grid", gap: tokens.space(1) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: "12px" }}>
          Resource
        </span>
        <select
          required
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          style={{
            padding: tokens.space(2),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            background: tokens.color.surface,
            color: tokens.color.textPrimary,
          }}
        >
          <option value="">Select resource</option>
          {resources.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: tokens.space(1) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: "12px" }}>
          Task
        </span>
        <select
          required
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          style={{
            padding: tokens.space(2),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            background: tokens.color.surface,
            color: tokens.color.textPrimary,
          }}
        >
          <option value="">Select task</option>
          {tasks.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <TextField
        label="Start"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
      />

      <TextField
        label="End"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
      />

      <TextField
        label="Planned quantity"
        type="number"
        min={0}
        step="0.01"
        value={plannedQuantity}
        onChange={(e) => setPlannedQuantity(e.target.value)}
        required
      />

      <TextField
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional"
      />

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <Button type="submit" disabled={pending}>
          {pending ? "Allocating…" : "Create allocation"}
        </Button>
      </div>

      {error && (
        <div
          style={{
            gridColumn: "1 / -1",
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
