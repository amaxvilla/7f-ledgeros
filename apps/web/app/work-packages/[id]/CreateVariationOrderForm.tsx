'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { createVariationOrder } from './actions';

/**
 * Frontend Completion — Variation Orders, the direct continuation of
 * Retention (FE-5.5's own recommendation, following the fixed-and-
 * reverified baseline FIX.4 established).
 *
 * A normal page-level form (like `ReleaseRetentionForm`/
 * `CreateProgressValuationForm`), not a per-row inline one like
 * `GenerateCertificateForm` — a work package can have any number of
 * variation orders, but this form isn't scoped to an existing row the
 * way certificate generation is (there's no "parent" row to attach to;
 * the register table below is what this form populates).
 *
 * `CreateVariationOrderDto` was confirmed directly (`pmo.service.ts`)
 * to be a plain flat object — `workPackageId`, `voNumber`, `description`,
 * `amount` — with `createdById` injected server-side, same shape
 * `CreateProgressValuationForm` already established for the same
 * reason. NOTABLE, and worth calling out rather than silently
 * mirroring: unlike every other `Create*Dto` in this codebase,
 * `CreateVariationOrderDto` is a plain TypeScript `interface` defined
 * inline in `pmo.service.ts`, not a `class-validator`-decorated DTO
 * class in its own `dto/*.dto.ts` file — confirmed directly, not
 * assumed from the naming convention alone. There is therefore no
 * server-side field validation at all for this endpoint (no
 * `@IsString()`/`@IsNumber()`, no `ValidationPipe` enforcement), and no
 * `@Min`/`@Max` constraint on `amount` — a variation order can
 * legitimately be a deduction (negative) as well as an addition
 * (positive), so this form's own `amount` field intentionally has no
 * `min` HTML hint, unlike `ReleaseRetentionForm`'s. This is a real,
 * pre-existing backend gap (missing request validation), not something
 * this checkpoint's own frontend work should paper over by inventing
 * client-side constraints the server itself doesn't enforce — flagged
 * in the checkpoint report rather than silently worked around here.
 */
export function CreateVariationOrderForm({ workPackageId }: { workPackageId: string }) {
  const [voNumber, setVoNumber] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createVariationOrder({
      workPackageId,
      voNumber,
      description,
      amount: Number(amount),
    });

    setPending(false);
    if (result.ok) {
      setVoNumber('');
      setDescription('');
      setAmount('');
    } else {
      setError(result.error ?? 'Failed to create variation order.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <TextField
        label="VO number"
        value={voNumber}
        onChange={(e) => setVoNumber(e.target.value)}
        required
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        style={{ minWidth: '260px' }}
      />
      <TextField
        label="Amount"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create variation order'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
