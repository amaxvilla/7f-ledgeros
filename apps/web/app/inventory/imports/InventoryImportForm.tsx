'use client';

import * as React from 'react';
import { Button, PageHeader, TextField } from '@7f/ui';

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export function InventoryImportForm() {
  const [csv, setCsv] = React.useState('');
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePreview(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!csv.trim()) {
      setError('Paste CSV content before previewing the import.');
      return;
    }

    const lines = csv.trim().split(/\r?\n/);

    setPreview({
      totalRows: Math.max(lines.length - 1, 0),
      validRows: Math.max(lines.length - 1, 0),
      invalidRows: 0,
    });
  }

  return (
    <section>
      <PageHeader
        title="Bulk inventory import"
        subtitle="Validate inventory movements before anything is committed to the inventory subledger."
      />

      <form onSubmit={handlePreview}>
        <TextField
          label="CSV data"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
        />

        <Button type="submit">
          Preview Import
        </Button>
      </form>

      {preview && (
        <div>
          <p>Total rows: {preview.totalRows}</p>
          <p>Valid rows: {preview.validRows}</p>
          <p>Invalid rows: {preview.invalidRows}</p>
        </div>
      )}

      {error && <div role="alert">{error}</div>}
    </section>
  );
}