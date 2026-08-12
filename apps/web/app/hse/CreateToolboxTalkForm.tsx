'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { createToolboxTalk } from './actions';

/**
 * Frontend Completion, HSE.3 — see `actions.ts`'s own doc comment for
 * the full before-coding analysis. `projectId` reuses the exact same
 * `projectOptions` prop `CreateIncidentReportForm` already established
 * (the same `GET /dimensions/projects?entityId=` fetch, no new call) —
 * optional here too, matching `CreateToolboxTalkDto.projectId`.
 * `conductedById` stays a plain, REQUIRED `TextField` (unlike Corrective
 * Actions' own optional `assignedToId`) — `CreateToolboxTalkDto.
 * conductedById` has no `?`, confirmed directly in `hse.service.ts`
 * rather than assumed symmetric with the optional fields elsewhere in
 * this app; still a plain `TextField`, not a `Select`, for the same
 * "no Users/Employees registry exists yet" reason every other
 * free-text assignee/conductor field in this app already has.
 */
export function CreateToolboxTalkForm({ entityId, projectOptions }: { entityId: string; projectOptions: SelectOption[] }) {
  const [projectId, setProjectId] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [talkDate, setTalkDate] = React.useState('');
  const [conductedById, setConductedById] = React.useState('');
  const [attendeeCount, setAttendeeCount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createToolboxTalk({
      entityId,
      projectId: projectId || undefined,
      topic,
      talkDate,
      conductedById,
      attendeeCount: Number(attendeeCount),
      notes: notes || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to log toolbox talk.');
      return;
    }
    setProjectId('');
    setTopic('');
    setTalkDate('');
    setConductedById('');
    setAttendeeCount('');
    setNotes('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Project (optional)"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        options={projectOptions}
        placeholder="No project"
        style={{ minWidth: '200px' }}
      />
      <TextField label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} required style={{ minWidth: '220px' }} />
      <TextField label="Date" type="date" value={talkDate} onChange={(e) => setTalkDate(e.target.value)} required />
      <TextField
        label="Conducted by"
        value={conductedById}
        onChange={(e) => setConductedById(e.target.value)}
        required
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Attendee count"
        type="number"
        min="0"
        value={attendeeCount}
        onChange={(e) => setAttendeeCount(e.target.value)}
        required
        style={{ minWidth: '120px' }}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ minWidth: '200px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Logging…' : 'Log toolbox talk'}
      </Button>
      {error && <div style={{ width: '100%', color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
    </form>
  );
}
