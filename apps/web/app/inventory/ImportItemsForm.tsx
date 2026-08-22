'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { createStockItemsBulk } from './actions';

export function ImportItemsForm({ entityId }: { entityId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { parseImportFileAction } = await import('../../lib/importActions');
      const res = await parseImportFileAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      
      const rows = res.data.rows;
      const items = rows.map((row: any) => ({
        code: row.code,
        name: row.name,
        domain: row.domain || 'GOODS',
        unitOfMeasure: row.unitOfMeasure || 'PCS'
      })).filter((i: any) => i.code && i.name);

      if (items.length === 0) {
        setError('No valid items found in file (ensure "code" and "name" columns exist).');
        return;
      }

      const result = await createStockItemsBulk(entityId, items);
      if (result.ok) {
        setSuccessMsg(`Imported ${result.data?.created || items.length} stock items successfully.`);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPending(false);
      if (e.target) e.target.value = '';
    }
  }

  return (
    <div style={{ padding: tokens.space(4), border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md, marginBottom: tokens.space(6) }}>
      <div style={{ display: 'flex', gap: tokens.space(4), justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: tokens.font.body }}>Bulk Import Stock Items</h3>
        <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/ITEM?format=csv`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (CSV)</a>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/ITEM?format=xlsx`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (XLSX)</a>
          <label style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 8px', border: `1px solid ${tokens.color.border}`, borderRadius: '4px' }}>
            Upload CSV/XLSX
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} style={{ display: 'none' }} disabled={pending} />
          </label>
        </div>
      </div>
      
      {pending && <div style={{ marginTop: tokens.space(3), fontSize: '13px', color: tokens.color.textMuted }}>Processing import...</div>}
      {error && <div style={{ marginTop: tokens.space(3), fontSize: '13px', color: tokens.color.negative }}>{error}</div>}
      {successMsg && <div style={{ marginTop: tokens.space(3), fontSize: '13px', color: tokens.color.positive }}>{successMsg}</div>}
    </div>
  );
}
