'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-9.2. `fiscalPeriodId`/`comparativeFiscalPeriodId`
 * are both plain text inputs, not `Select`s — confirmed directly no
 * `FiscalPeriod` list endpoint exists anywhere in this backend (grepped
 * every `*.controller.ts` for a `fiscal-period` route or `FiscalPeriod`
 * reference outside `reporting.controller.ts` itself). Same "opaque ID,
 * no registry" posture this app takes everywhere else that gap exists
 * (`ScheduleHandoverForm`'s `allocationId`, `CreateWorkPackageForm`'s
 * `contractorId`) — a small, real, separate gap (a fiscal-periods list
 * endpoint) worth naming rather than silently building one as a
 * side-quest to this checkpoint's own scope.
 */
export function PeriodSelector({ entityId, fiscalPeriodId, comparativeFiscalPeriodId }: { entityId: string; fiscalPeriodId?: string; comparativeFiscalPeriodId?: string }) {
  const [period, setPeriod] = React.useState(fiscalPeriodId ?? '');
  const [comparative, setComparative] = React.useState(comparativeFiscalPeriodId ?? '');
  const periodId = React.useId();
  const comparativeId = React.useId();

  return (
    <form method="GET" style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6), flexWrap: 'wrap' }}>
      <input type="hidden" name="entityId" value={entityId} />
      <label htmlFor={periodId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        Fiscal period ID
      </label>
      <input
        id={periodId}
        name="fiscalPeriodId"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        placeholder="e.g. 3fae0c9e-..."
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.mono,
          fontSize: '13px',
          minWidth: '280px',
        }}
      />
      <label htmlFor={comparativeId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        Comparative period ID (optional)
      </label>
      <input
        id={comparativeId}
        name="comparativeFiscalPeriodId"
        value={comparative}
        onChange={(e) => setComparative(e.target.value)}
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.mono,
          fontSize: '13px',
          minWidth: '280px',
        }}
      />
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
        View statements
      </button>
    </form>
  );
}
