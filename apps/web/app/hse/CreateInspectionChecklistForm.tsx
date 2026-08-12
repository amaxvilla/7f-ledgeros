'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createInspectionChecklist } from './actions';

interface Item {
  itemDescription: string;
}

const EMPTY_ITEM: Item = { itemDescription: '' };

/**
 * Frontend Completion, HSE.5 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. This is the checkpoint HSE.3's and
 * HSE.4's own reports both named as needing a genuinely different,
 * larger treatment than any other HSE sub-resource: `CreateInspection
 * ChecklistDto.items` (confirmed directly in `hse.service.ts`) is a
 * repeatable array, `{ itemDescription: string }[]`, not a flat shape.
 *
 * Reuses `CreateRequisitionForm`'s own dynamic add/remove-row pattern
 * directly (confirmed directly as this app's established shape for a
 * repeatable-array DTO field, itself inherited from
 * `CreateJournalEntryForm`) — a local `items` array in state, `update
 * Item`/`addItem`/`removeItem` helpers, one row rendered per entry,
 * "Remove" disabled once only one item remains. `createInspection
 * Checklist` throws a `BadRequestException` if `items.length === 0`
 * (confirmed directly) — the same "start with one row, never let it go
 * to zero" floor `CreateRequisitionForm`'s own single-line minimum
 * already established, not `CreateJournalEntryForm`'s two-line one
 * (that minimum is for a balanced debit/credit entry, a different
 * constraint that doesn't apply here).
 *
 * `checklistType` is a plain, REQUIRED `TextField`, not a `Select` —
 * confirmed directly in `schema.prisma` that `InspectionChecklist.
 * checklistType` is a bare `String` column, its own comment giving
 * examples ("Scaffolding", "Fire Safety", "Site Housekeeping") rather
 * than a fixed enum — there is no fixed set of values to build a
 * `Select` from.
 *
 * `inspectorId` stays a plain, REQUIRED `TextField` — the same "no
 * Users/Employees registry reachable from this page's permission
 * scope" reasoning `conductedById`/`inspectorId`'s siblings
 * (`assignedToId`, HSE.4's own `employeeId`) already established.
 *
 * `projectId` (optional) reuses the same `projectOptions` prop
 * `CreateIncidentReportForm`/`CreateToolboxTalkForm` already
 * established — no new fetch.
 *
 * Per-item result recording (`POST /inspection-checklist-items/:itemId
 * /result`) and finalization (`POST /inspection-checklists/:id/
 * finalize`) are DELIBERATELY NOT built in this checkpoint — both
 * operate on a checklist's items AFTER creation (an existing row's own
 * `id`s, not something this create form has), a genuinely separate
 * per-row-actions checkpoint the same way HSE.2 split Corrective
 * Actions' create form from its own `Complete` action's timing, except
 * here the two are large enough (an item-level result form nested
 * inside a checklist row, plus a checklist-level finalize button) to
 * warrant their own checkpoint rather than folding into this one.
 *
 * ADDENDUM (FE-10.25, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add item),
 * same fix `CreateRequisitionForm`/`CreatePurchaseOrderForm` each got
 * in this same batch. Verified directly against this file's own
 * current source before fixing.
 */
export function CreateInspectionChecklistForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [checklistType, setChecklistType] = React.useState('');
  const [inspectionDate, setInspectionDate] = React.useState('');
  const [inspectorId, setInspectorId] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([{ ...EMPTY_ITEM }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { itemDescription: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createInspectionChecklist({
      entityId,
      projectId: projectId || undefined,
      checklistType,
      inspectionDate,
      inspectorId,
      items: items.map((item) => ({ itemDescription: item.itemDescription })),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to create inspection checklist.');
      return;
    }
    setProjectId('');
    setChecklistType('');
    setInspectionDate('');
    setInspectorId('');
    setItems([{ ...EMPTY_ITEM }]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
        <Select
          label="Project (optional)"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projectOptions}
          placeholder="No project"
          style={{ minWidth: '200px' }}
        />
        <TextField
          label="Checklist type"
          value={checklistType}
          onChange={(e) => setChecklistType(e.target.value)}
          required
          style={{ minWidth: '200px' }}
        />
        <TextField label="Inspection date" type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} required />
        <TextField
          label="Inspector"
          value={inspectorId}
          onChange={(e) => setInspectorId(e.target.value)}
          required
          style={{ minWidth: '160px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Items</span>
        {items.map((item, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Item description (item ${index + 1})`}
              value={item.itemDescription}
              onChange={(e) => updateItem(index, e.target.value)}
              required
              style={{ minWidth: '280px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addItem}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add item
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create checklist'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
