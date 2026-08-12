'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createSurveyPlan } from './actions';

/**
 * Frontend Completion, FE-4.3 — Survey Plans, FE-4.2's own recommended
 * direct continuation on this same `/land-bank/[parcelId]` detail page.
 * `CreateSurveyPlanDto` (confirmed directly) is flat with no enum
 * field, unlike `AddTitleDeedDto`'s `titleType` — `planNumber` required,
 * `surveyorName`/`surveyDate`/`areaSqm`/`documentRef` all plain optional
 * fields, `surveyDate` a native `type="date"` field (same established
 * convention `applicationDate` already uses on `AddTitleDeedForm`).
 *
 * `coordinates` (`@IsOptional() @IsObject()`, a free-form JSON object
 * on the DTO) is DELIBERATELY NOT a field on this form — this app has
 * no JSON-object-input primitive anywhere (confirmed by grepping for
 * one; every free-text field in this codebase is a single-line
 * `TextField`, never even a `<textarea>`, per `RecordAcquisitionForm`'s
 * own `dueDiligenceNotes` precedent), and a raw-JSON `TextField` would
 * be error-prone to hand-type correctly. Left for a future checkpoint
 * if a real need for entering coordinates surfaces, not invented here.
 *
 * `planNumber` + `parcelId` are jointly unique (`@@unique([parcelId,
 * planNumber])`, confirmed directly) — a collision surfaces as whatever
 * `ConflictException` message the backend returns, not pre-validated
 * client-side, same posture every other form in this app takes toward
 * its own server-enforced uniqueness constraints.
 */
export function CreateSurveyPlanForm({ parcelId }: { parcelId: string }) {
  const [planNumber, setPlanNumber] = React.useState('');
  const [surveyorName, setSurveyorName] = React.useState('');
  const [surveyDate, setSurveyDate] = React.useState('');
  const [areaSqm, setAreaSqm] = React.useState('');
  const [documentRef, setDocumentRef] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createSurveyPlan({
      parcelId,
      planNumber,
      surveyorName: surveyorName || undefined,
      surveyDate: surveyDate || undefined,
      areaSqm: areaSqm ? Number(areaSqm) : undefined,
      documentRef: documentRef || undefined,
    });

    setPending(false);
    if (result.ok) {
      setPlanNumber('');
      setSurveyorName('');
      setSurveyDate('');
      setAreaSqm('');
      setDocumentRef('');
    } else {
      setError(result.error ?? 'Failed to add survey plan.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField label="Plan number" value={planNumber} onChange={(e) => setPlanNumber(e.target.value)} required style={{ minWidth: '160px' }} />
      <TextField
        label="Surveyor (optional)"
        value={surveyorName}
        onChange={(e) => setSurveyorName(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Survey date (optional)"
        type="date"
        value={surveyDate}
        onChange={(e) => setSurveyDate(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Area sqm (optional)"
        type="number"
        step="0.01"
        value={areaSqm}
        onChange={(e) => setAreaSqm(e.target.value)}
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Document ref (optional)"
        value={documentRef}
        onChange={(e) => setDocumentRef(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add survey plan'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
