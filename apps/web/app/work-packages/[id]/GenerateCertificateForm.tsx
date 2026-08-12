'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { generateCertificate } from './actions';

/**
 * Frontend Completion — Interim Payment Certificates, PMO.3's own
 * recommended direct continuation. Rendered only for an `APPROVED`
 * progress valuation with no existing certificate (`page.tsx`'s own
 * "Certificate" column decides which of three states to show; this
 * component only ever handles the "eligible, not yet generated" one).
 *
 * Starts collapsed as a single small button — expanding to three fields
 * inline, in the same table cell, rather than a modal (this app has no
 * modal primitive anywhere; same "no confirm dialog, use a second
 * button/inline state instead" posture `VacancyActions`'s own doc
 * comment already established, just extended from "a second button" to
 * "a small inline form" since three required fields don't fit as
 * button labels). This is the first `Create*`-shaped form in this app
 * that lives inside a table cell rather than above the table — a direct
 * consequence of `generateCertificate` being scoped to one specific
 * progress valuation row, not a general "create" action for the whole
 * page the way every other `Create*Form` is.
 *
 * `certificateNumber` is a plain required `TextField` — unlike
 * `valuationNumber` (server-computed, never sent), `certificateNumber`
 * IS client-supplied and globally unique (confirmed directly against
 * the schema's own `@unique`); a collision surfaces as whatever
 * `ApiError` message the backend returns, not pre-validated here.
 * `retentionPercent` is a numeric `TextField` with `min`/`max` HTML
 * hints (0-100, server-enforced — same "hint, don't duplicate
 * validation" posture `CreateProgressValuationForm`'s own
 * `percentComplete` field already takes). `issuedDate` is a native
 * `type="date"` field, same convention `CreateIssueForm`'s `dueDate`
 * already established.
 *
 * ADDENDUM (FE-10.33, Mobile Responsiveness rollout) — all three
 * `Button` usages' own compact `style` override removed (the collapsed
 * trigger, Generate, and Cancel), including inside this table cell —
 * same reasoning `FeatureFlagRow`'s own sibling ADDENDUM gives for
 * fixing a per-row button too: a smaller touch target in a dense
 * context is worse, not better. Verified directly against this file's
 * own current source before fixing.
 */
export function GenerateCertificateForm({ progressValuationId, workPackageId }: { progressValuationId: string; workPackageId: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [certificateNumber, setCertificateNumber] = React.useState('');
  const [retentionPercent, setRetentionPercent] = React.useState('');
  const [issuedDate, setIssuedDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await generateCertificate({
      progressValuationId,
      workPackageId,
      certificateNumber,
      retentionPercent: Number(retentionPercent),
      issuedDate,
    });

    setPending(false);
    if (result.ok) {
      setExpanded(false);
      setCertificateNumber('');
      setRetentionPercent('');
      setIssuedDate('');
    } else {
      setError(result.error ?? 'Failed to generate certificate.');
    }
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setExpanded(true)}
      >
        Generate certificate
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(2), alignItems: 'flex-end', minWidth: '180px' }}
    >
      <TextField
        label="Certificate #"
        value={certificateNumber}
        onChange={(e) => setCertificateNumber(e.target.value)}
        required
        style={{ width: '100%', fontSize: '12px' }}
      />
      <TextField
        label="Retention %"
        type="number"
        min={0}
        max={100}
        value={retentionPercent}
        onChange={(e) => setRetentionPercent(e.target.value)}
        required
        style={{ width: '100%', fontSize: '12px' }}
      />
      <TextField
        label="Issued date"
        type="date"
        value={issuedDate}
        onChange={(e) => setIssuedDate(e.target.value)}
        required
        style={{ width: '100%', fontSize: '12px' }}
      />
      <div style={{ display: 'flex', gap: tokens.space(2) }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Generating…' : 'Generate'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setExpanded(false)}
        >
          Cancel
        </Button>
      </div>
      {error && <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.negative }}>{error}</span>}
    </form>
  );
}
