'use client';

import { Button } from '@7f/ui';

/**
 * Frontend Completion, FE-9.5 — Report Export & Print, picked up after
 * confirming (against `apps/api/src`) that the roadmap's remaining
 * FE-9 items split into two very different kinds of gap: "Scheduled
 * Reports" has NO backing model anywhere in `schema.prisma` at all — a
 * genuine backend feature this frontend-only pass can't responsibly
 * build around — while "Export"/"Print" need no backend at all: every
 * statement this page already fetches is already fully in hand,
 * client-side. This checkpoint builds the two that are actually
 * buildable and leaves Scheduled Reports named, not attempted.
 *
 * Deliberately a plain CSV serializer, not a library (`papaparse` is
 * available per this environment's own conventions, but pulling it in
 * for "join fields with commas, quote ones that contain a comma or
 * quote" is more dependency than this narrow, already-flat-shaped data
 * needs) — `LineItemRow[]` (this page's own export target) has no
 * nested values and no embedded newlines in practice (account codes/
 * names), so the minimal RFC 4180 quoting handled here (escape `"` as
 * `""`, wrap in quotes only when the field contains a comma, quote, or
 * newline) is sufficient for this data without a general-purpose
 * dependency.
 *
 * Runs entirely in the browser via a `Blob` + a synthetic `<a>` click,
 * same "no server round trip needed for something already fetched"
 * reasoning `KeyValueEditor.tsx`'s own client-side JSON handling uses,
 * applied here to CSV instead of JSON.
 *
 * ADDENDUM (FE-10.35, Mobile Responsiveness rollout) — a THIRD override
 * shape this rollout's own `space(2)`/`space(3)` literal-string sweeps
 * (FE-10.30, FE-10.34) would never have caught: `padding: '4px 12px'`,
 * raw pixel strings rather than a `tokens.space()` call — found via
 * FE-10.34's own recommended broader sweep (`<Button` usages with any
 * `padding` in their own `style`, not just the two previously-known
 * exact strings). `fontSize: '12px'` removed too, matching every other
 * fix in this rollout. Found alongside `PrintButton.tsx`, its own
 * sibling in this same directory with the identical override — both
 * fixed in the same checkpoint.
 */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))];
  return lines.join('\n');
}

export function ExportCsvButton({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  function handleExport() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" onClick={handleExport}>
      Export CSV
    </Button>
  );
}
