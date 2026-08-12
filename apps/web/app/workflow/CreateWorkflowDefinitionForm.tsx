'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createWorkflowDefinition } from './actions';
import type { CreateStageInput } from './actions';

const STAGE_TYPE_OPTIONS: SelectOption[] = ['DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVAL', 'POSTED', 'ARCHIVED'].map((v) => ({
  value: v,
  label: v,
}));

interface StageRow {
  sequence: string;
  name: string;
  stageType: string;
  requiredRoleCode: string;
  minApprovals: string;
}

function emptyStage(sequence: number): StageRow {
  return { sequence: String(sequence), name: '', stageType: '', requiredRoleCode: '', minApprovals: '' };
}

/**
 * Frontend Completion, FE-8.10 — `CreateWorkflowDefinitionForm`, the
 * first-pass Workflow Definitions create form. Same plain `useState`
 * dynamic add/remove-row shape `CreateBudgetForm` already established
 * for this app's first array field — not extracted into a shared
 * `<FieldArray>` abstraction here either, same reasoning (a single
 * caller isn't enough to guess a good shared shape from).
 *
 * NO `rules[]` PER STAGE, NO `workflowRules[]` AT ALL — see `actions.ts`'s
 * own doc comment for why both are safe to omit entirely rather than
 * sent as empty arrays (both genuinely optional, confirmed against the
 * DTO and the service's own guard clauses). A future checkpoint adding
 * either is a real, separate, larger piece of work — a rule-builder UI
 * (field/operator/value, `WorkflowRuleField`/`WorkflowRuleOperator`
 * enums) nested inside an already-dynamic stage row, not attempted
 * here.
 *
 * `requiredRoleCode` is a `Select` built from `roleOptions` — passed
 * down from `page.tsx`, which fetches `GET /roles` (`RBAC_VIEW`) the
 * same `accountOptions`-down-a-prop shape `CreateBudgetForm` already
 * established. A REAL, WORTH-NAMING PERMISSION MISMATCH: creating a
 * workflow definition itself needs `workflow.admin`; populating this
 * one optional field's own picker needs the unrelated `RBAC_VIEW`.
 * `page.tsx` degrades gracefully (an empty `roleOptions` array, not a
 * page-level error) if the current user can create workflow
 * definitions but can't view roles — this field then simply offers
 * only "No specific role required," never a broken picker.
 *
 * CLIENT-SIDE DUPLICATE-SEQUENCE CHECK: `WorkflowEngineService
 * .createDefinition` rejects duplicate `sequence` values across stages
 * with a `BadRequestException` (confirmed directly) — detected here
 * too, disabling submission with an inline message, so a mis-typed
 * sequence number is caught before a round-trip rather than only after
 * one.
 *
 * `sequence` for each newly-added row defaults to `stages.length + 1`
 * (a reasonable starting point for building stages in order) but stays
 * a fully editable `TextField`, not a read-only computed value — the
 * backend's own validation is the actual source of truth for whether a
 * given set of sequence numbers is acceptable, not this form's default.
 *
 * ADDENDUM (FE-10.33, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add stage),
 * the same fix this rollout has now applied to every dynamic
 * line-item form across the app. Verified directly against this
 * file's own current source before fixing.
 */
export function CreateWorkflowDefinitionForm({ roleOptions }: { roleOptions: SelectOption[] }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [entityType, setEntityType] = React.useState('');
  const [stages, setStages] = React.useState<StageRow[]>([emptyStage(1)]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const sequenceValues = stages.map((s) => s.sequence.trim()).filter((s) => s !== '');
  const hasDuplicateSequence = new Set(sequenceValues).size !== sequenceValues.length;

  function updateStage(index: number, field: keyof StageRow, value: string) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setSuccess(false);
  }

  function addStage() {
    setStages((prev) => [...prev, emptyStage(prev.length + 1)]);
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const stageInputs: CreateStageInput[] = stages.map((s) => ({
      sequence: Number(s.sequence),
      name: s.name,
      stageType: s.stageType,
      requiredRoleCode: s.requiredRoleCode || undefined,
      minApprovals: s.minApprovals ? Number(s.minApprovals) : undefined,
    }));

    const result = await createWorkflowDefinition({
      code,
      name,
      description: description || undefined,
      entityType,
      stages: stageInputs,
    });

    setPending(false);
    if (result.ok) {
      setCode('');
      setName('');
      setDescription('');
      setEntityType('');
      setStages([emptyStage(1)]);
      setSuccess(true);
    } else {
      setError(result.error ?? 'Failed to create workflow definition.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(8),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
        <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ minWidth: '160px' }} />
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ minWidth: '220px' }} />
        <TextField
          label="Entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          required
          style={{ minWidth: '180px' }}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ minWidth: '260px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Stages</span>
        {stages.map((stage, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Sequence (${index + 1})`}
              type="number"
              value={stage.sequence}
              onChange={(e) => updateStage(index, 'sequence', e.target.value)}
              required
              style={{ minWidth: '110px' }}
            />
            <TextField
              label={`Stage name (${index + 1})`}
              value={stage.name}
              onChange={(e) => updateStage(index, 'name', e.target.value)}
              required
              style={{ minWidth: '180px' }}
            />
            <Select
              label={`Stage type (${index + 1})`}
              value={stage.stageType}
              onChange={(e) => updateStage(index, 'stageType', e.target.value)}
              options={STAGE_TYPE_OPTIONS}
              placeholder="Select a type…"
              required
              style={{ minWidth: '160px' }}
            />
            <Select
              label={`Required role (${index + 1})`}
              value={stage.requiredRoleCode}
              onChange={(e) => updateStage(index, 'requiredRoleCode', e.target.value)}
              options={roleOptions}
              placeholder="No specific role required"
              style={{ minWidth: '200px' }}
            />
            <TextField
              label={`Min approvals (${index + 1})`}
              type="number"
              value={stage.minApprovals}
              onChange={(e) => updateStage(index, 'minApprovals', e.target.value)}
              placeholder="1"
              style={{ minWidth: '140px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removeStage(index)}
              disabled={stages.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addStage}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add stage
        </Button>
      </div>

      {hasDuplicateSequence && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Stage sequence numbers must be unique.
        </div>
      )}

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending || hasDuplicateSequence}>
          {pending ? 'Creating…' : 'Create workflow definition'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
        {success && (
          <div style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>
            Workflow definition created.
          </div>
        )}
      </div>
    </form>
  );
}
