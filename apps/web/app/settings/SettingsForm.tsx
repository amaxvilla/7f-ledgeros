'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { updateMyPreferences } from './actions';

const THEME_OPTIONS: SelectOption[] = [
  { value: 'SYSTEM', label: 'Match system' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
];

/**
 * FE-1.8 — Settings. A "settings" form, not a "new entry" one — same
 * pre-filled/no-reset-on-save posture `EditEntityForm.tsx` already
 * established for editing something that already exists, following its
 * own `handleSubmit`/`pending`/`error`/`saved` shape directly rather than
 * inventing a new one.
 *
 * `theme` here is a distinct concern from `ThemeToggle.tsx`'s own
 * `data-theme` attribute (FE-1.6) — that toggle is a pure, unauthenticated,
 * `localStorage`-only browser preference with no server-side source of
 * truth (see its own doc comment for why), while this field is
 * `UserPreference.theme` on the backend, a per-account setting that
 * follows the user across devices. Deliberately NOT wiring this field
 * into `ThemeToggle`'s own `data-theme` attribute in this checkpoint —
 * doing so correctly would mean `layout.tsx`'s blocking pre-paint script
 * (today `localStorage`-only) also needing a server round trip before
 * first paint, a real restructuring of that flash-prevention mechanism
 * that deserves its own checkpoint, not a silent side effect bundled
 * into this one. Named here rather than left unexplained.
 */
export function SettingsForm({
  initialTheme,
  initialLanguage,
  initialTimezone,
}: {
  initialTheme: 'LIGHT' | 'DARK' | 'SYSTEM';
  initialLanguage: string;
  initialTimezone: string;
}) {
  const [theme, setTheme] = React.useState(initialTheme);
  const [language, setLanguage] = React.useState(initialLanguage);
  const [timezone, setTimezone] = React.useState(initialTimezone);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateMyPreferences({
      theme,
      language: language || undefined,
      timezone: timezone || undefined,
    });

    setPending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Failed to save settings.');
    }
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
        marginBottom: tokens.space(4),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as 'LIGHT' | 'DARK' | 'SYSTEM')}
        options={THEME_OPTIONS}
        style={{ minWidth: '160px' }}
      />
      <TextField
        label="Language (optional)"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        placeholder="en"
        style={{ minWidth: '140px' }}
      />
      <TextField
        label="Timezone (optional)"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        placeholder="Africa/Lagos"
        style={{ minWidth: '180px' }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {saved && !pending && (
        <span style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Saved.</span>
      )}
      {error && (
        <span style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</span>
      )}
    </form>
  );
}
