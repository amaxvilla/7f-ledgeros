'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { bulkImportPaymentBatch } from './actions';

export function ImportPaymentBatchForm({ entityId }: { entityId: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<React.ReactNode | null>(null);

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
      if (rows.length === 0) {
        setError('No rows found in file.');
        return;
      }

      // Generate a batch from the first row or current date
      const batchNumber = `IMP-${Date.now()}`;
      const paymentDate = new Date().toISOString().split('T')[0];

      // Group vouchers by voucherNumber
      const vouchersMap = new Map<string, any>();
      for (const row of rows) {
        const vn = row.voucherNumber;
        if (!vn) continue;
        if (!vouchersMap.has(vn)) {
          vouchersMap.set(vn, {
            entityId,
            voucherNumber: vn,
            vendorId: row.vendorId,
            paymentDate: row.paymentDate || paymentDate,
            paymentMethod: row.paymentMethod || 'BANK_TRANSFER',
            bankAccountId: row.bankAccountId,
            allocations: []
          });
        }
        const v = vouchersMap.get(vn);
        v.allocations.push({
          vendorInvoiceId: row.vendorInvoiceId,
          amountAllocated: Number(row.amountAllocated) || 0,
        });
      }

      const vouchers = Array.from(vouchersMap.values());
      if (vouchers.length === 0) {
        setError('No valid vouchers found in file (ensure "voucherNumber" and "vendorId" exist).');
        return;
      }

      const result = await bulkImportPaymentBatch({
        entityId,
        batchNumber,
        paymentDate,
        vouchers
      });

      if (result.ok) {
        setSuccessMsg(
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
            <span style={{ color: tokens.color.positive }}>Imported {result.data?.createdVouchers || vouchers.length} vouchers into batch.</span>
            <code style={{ fontFamily: tokens.font.mono, fontSize: '12px', background: tokens.color.surfaceRaised, padding: '2px 4px' }}>
              {result.data?.batchId}
            </code>
          </div>
        );
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
        <h3 style={{ margin: 0, fontFamily: tokens.font.body }}>Bulk Import Payment Batch</h3>
        <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/PAYMENT?format=csv`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (CSV)</a>
          <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/imports/template/PAYMENT?format=xlsx`} style={{ fontSize: '13px', color: tokens.color.accent }}>Template (XLSX)</a>
          <label style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 8px', border: `1px solid ${tokens.color.border}`, borderRadius: '4px' }}>
            Upload CSV/XLSX
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} style={{ display: 'none' }} disabled={pending} />
          </label>
        </div>
      </div>
      
      {pending && <div style={{ marginTop: tokens.space(3), fontSize: '13px', color: tokens.color.textMuted }}>Processing import...</div>}
      {error && <div style={{ marginTop: tokens.space(3), fontSize: '13px', color: tokens.color.negative }}>{error}</div>}
      {successMsg && <div style={{ marginTop: tokens.space(3), fontSize: '13px' }}>{successMsg}</div>}
    </div>
  );
}
