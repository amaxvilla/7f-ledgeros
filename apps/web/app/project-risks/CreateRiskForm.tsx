'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createRisk } from './actions';

const PROBABILITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const IMPACT_OPTIONS = PROBABILITY_OPTIONS;

/**
 * Frontend Completion — `projectId` is now a `Select` fed by the
 * caller-supplied `projectOptions` prop, not a plain `TextField` the
 * way this doc comment previously claimed it had to be. That prior
 * claim ("no Projects registry exists anywhere in this backend to
 * build one from") was WRONG — caught and corrected during FE-2.5
 * (`ProjectSelector`/PMO Dashboard's own checkpoint): `GET
 * /dimensions/projects?entityId=X` (`DimensionsController.findProjects`)
 * has existed the whole time. This checkpoint is the small,
 * previously-deferred follow-up FE-2.5's own report named — `page.tsx`
 * fetches the entity's own projects and passes `projectOptions` down,
 * the same "fetch in the Server Component, pass the array down" pattern
 * `CreateBudgetForm`'s own `accountOptions` prop already established.
 *
 * `ownerId` stays a plain optional `TextField` — a user id, and this
 * app still has no user-picker anywhere; unrelated to the Projects
 * registry correction above and out of scope for it.
 *
 * `probability`/`impact` default to MEDIUM server-side
 * (`CreateRiskDto`/`RiskService.createRisk` both read directly) if left
 * unselected — this form's own `Select`s start on `''` (the
 * placeholder) rather than pre-selecting `MEDIUM`, so submitting
 * without touching them sends `undefined` for both and lets the
 * backend's own default apply, rather than this form silently
 * hardcoding a value the backend already owns.
 */
export function CreateRiskForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [probability, setProbability] = React.useState('');
  const [impact, setImpact] = React.useState('');
  const [ownerId, setOwnerId] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createRisk({
      entityId,
      projectId,
      title,
      description: description || undefined,
      category: category || undefined,
      probability: probability || undefined,
      impact: impact || undefined,
      ownerId: ownerId || undefined,
    });

    setPending(false);
    if (result.ok) {
      setProjectId('');
      setTitle('');
      setDescription('');
      setCategory('');
      setProbability('');
      setImpact('');
      setOwnerId('');
    } else {
      setError(result.error ?? 'Failed to create risk.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end', marginBottom: tokens.space(6) }}
    >
      <Select
        label="Project"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        options={projectOptions}
        placeholder="Select a project…"
        required
        style={{ minWidth: '200px' }}
      />
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ minWidth: '200px' }} />
      <TextField
        label="Category (optional)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Probability"
        value={probability}
        onChange={(e) => setProbability(e.target.value)}
        options={PROBABILITY_OPTIONS}
        placeholder="Default (Medium)"
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Impact"
        value={impact}
        onChange={(e) => setImpact(e.target.value)}
        options={IMPACT_OPTIONS}
        placeholder="Default (Medium)"
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Owner ID (optional)"
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
        style={{ minWidth: '180px' }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ minWidth: '220px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Logging…' : 'Log risk'}
      </Button>
      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}

