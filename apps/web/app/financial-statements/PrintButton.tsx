'use client';

import { Button } from '@7f/ui';

/**
 * Frontend Completion, FE-9.5 — see `ExportCsvButton.tsx`'s own doc
 * comment for the full before-coding reasoning shared by both. Print
 * uses the browser's own `window.print()` rather than a generated PDF
 * — this app has no PDF-generation library anywhere (`pdf`/`pdf-lib`/
 * similar aren't in any `package.json`), and every statement section
 * on this page is already plain, readable HTML — `window.print()`'s
 * own browser print-preview (with "Save as PDF" as a standard OS/
 * browser destination) covers the "Print" roadmap item without adding
 * a dependency this checkpoint doesn't need.
 *
 * ADDENDUM (FE-10.35, Mobile Responsiveness rollout) — see
 * `ExportCsvButton.tsx`'s own ADDENDUM (same checkpoint, same
 * directory, identical override found and fixed in both at once): the
 * same raw-pixel-string `padding: '4px 12px'`/`fontSize: '12px'`
 * override, a third shape this rollout's earlier token-literal sweeps
 * wouldn't have caught, removed here too.
 */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Print
    </Button>
  );
}
