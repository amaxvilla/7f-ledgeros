'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';
import type { ProjectOption } from '../ProjectSelector';

const SCOPE_OPTIONS: { value: 'PROJECT' | 'UNIT' | 'SALE'; label: string }[] = [
  { value: 'PROJECT', label: 'Project' },
  { value: 'UNIT', label: 'Unit' },
  { value: 'SALE', label: 'Sale (allocation)' },
];

const fieldStyle: React.CSSProperties = {
  background: tokens.color.surfaceRaised,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.textPrimary,
  padding: `${tokens.space(2)} ${tokens.space(3)}`,
  fontFamily: tokens.font.body,
  fontSize: '13px',
  minWidth: '260px',
};

/**
 * Same GET-form-navigates shape as `AgentSelector`/`ProjectSelector`.
 * `scope` picks which single target field is actually submitted —
 * `AgentAssignmentController.findForTarget` expects exactly one of
 * projectId/unitId/allocationId matching `scope`, so only the field for
 * the currently-selected scope is rendered in the DOM at all (an
 * unrendered field submits nothing, unlike a merely-hidden one).
 *
 * PROJECT uses a real `Select` (`GET /dimensions/projects?entityId=X`,
 * the same registry `ProjectSelector` already established). UNIT/SALE
 * have no such registry anywhere in this backend (confirmed directly —
 * no `GET /units` or `GET /unit-sale-allocations` list route exists) —
 * plain text inputs for those two, the same "opaque ID, no registry"
 * gap this app already names elsewhere (`PeriodSelector`'s own
 * `fiscalPeriodId`) rather than silently building a new list endpoint
 * as a side-quest to this checkpoint.
 */
export function TargetLookupForm({
  entityId,
  projectOptions,
  initialScope,
  initialProjectId,
  initialUnitId,
  initialAllocationId,
}: {
  entityId: string;
  projectOptions: ProjectOption[];
  initialScope?: 'PROJECT' | 'UNIT' | 'SALE';
  initialProjectId?: string;
  initialUnitId?: string;
  initialAllocationId?: string;
}) {
  const [scope, setScope] = React.useState<'PROJECT' | 'UNIT' | 'SALE'>(initialScope ?? 'PROJECT');
  const [projectId, setProjectId] = React.useState(initialProjectId ?? '');
  const [unitId, setUnitId] = React.useState(initialUnitId ?? '');
  const [allocationId, setAllocationId] = React.useState(initialAllocationId ?? '');
  const scopeId = React.useId();
  const targetId = React.useId();

  return (
    <form method="GET" style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-end', marginBottom: tokens.space(4), flexWrap: 'wrap' }}>
      <input type="hidden" name="entityId" value={entityId} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
        <label htmlFor={scopeId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Target type</label>
        <select id={scopeId} name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} style={fieldStyle}>
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {scope === 'PROJECT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
          <label htmlFor={targetId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Project</label>
          <select id={targetId} name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={fieldStyle}>
            <option value="">Select a project…</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
      )}

      {scope === 'UNIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
          <label htmlFor={targetId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Unit ID</label>
          <input id={targetId} name="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="e.g. 3fae0c9e-..." style={{ ...fieldStyle, fontFamily: tokens.font.mono }} />
        </div>
      )}

      {scope === 'SALE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
          <label htmlFor={targetId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Sale (allocation) ID</label>
          <input id={targetId} name="allocationId" value={allocationId} onChange={(e) => setAllocationId(e.target.value)} placeholder="e.g. 3fae0c9e-..." style={{ ...fieldStyle, fontFamily: tokens.font.mono }} />
        </div>
      )}

      <button
        type="submit"
        style={{
          background: tokens.color.accent,
          color: tokens.color.bg,
          border: 'none',
          borderRadius: tokens.radius.sm,
          padding: `${tokens.space(2)} ${tokens.space(4)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        View history
      </button>
    </form>
  );
}
