'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';

import {
  createGoodsReceipt,
  createMaterialIssue,
  createStockTransfer,
  createStockCount,
  postGoodsReceipt,
  postMaterialIssue,
  postStockTransfer,
  postStockCount,
} from './actions';

interface Props {
  warehouseOptions: SelectOption[];
  stockItemOptions: SelectOption[];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function positiveNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

function nonNegativeNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return parsed;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 8,
        padding: tokens.space(5),
        marginBottom: tokens.space(6),
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: tokens.space(4),
          fontFamily: tokens.font.display,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Result({
  id,
  error,
}: {
  id: string | null;
  error: string | null;
}) {
  if (!id && !error) return null;

  return (
    <div
      style={{
        marginTop: tokens.space(4),
        color: error ? tokens.color.negative : tokens.color.positive,
        fontFamily: tokens.font.body,
      }}
    >
      {error ? error : `Draft created: ${id}`}
    </div>
  );
}

export function InventoryTransactionForms({
  warehouseOptions,
  stockItemOptions,
}: Props) {
  const router = useRouter();

  const [receiptWarehouse, setReceiptWarehouse] = React.useState('');
  const [receiptVendor, setReceiptVendor] = React.useState('');
  const [receiptDate, setReceiptDate] = React.useState(today());
  const [receiptReference, setReceiptReference] = React.useState('');
  const [receiptItem, setReceiptItem] = React.useState('');
  const [receiptQuantity, setReceiptQuantity] = React.useState('');
  const [receiptUnitCost, setReceiptUnitCost] = React.useState('');
  const [receiptId, setReceiptId] = React.useState<string | null>(null);
  const [receiptError, setReceiptError] = React.useState<string | null>(null);
  const [receiptPending, setReceiptPending] = React.useState(false);

  const [issueWarehouse, setIssueWarehouse] = React.useState('');
  const [issueProject, setIssueProject] = React.useState('');
  const [issueCostCenter, setIssueCostCenter] = React.useState('');
  const [issueDate, setIssueDate] = React.useState(today());
  const [issuePurpose, setIssuePurpose] = React.useState('');
  const [issueItem, setIssueItem] = React.useState('');
  const [issueQuantity, setIssueQuantity] = React.useState('');
  const [issueId, setIssueId] = React.useState<string | null>(null);
  const [issueError, setIssueError] = React.useState<string | null>(null);
  const [issuePending, setIssuePending] = React.useState(false);

  const [transferFrom, setTransferFrom] = React.useState('');
  const [transferTo, setTransferTo] = React.useState('');
  const [transferDate, setTransferDate] = React.useState(today());
  const [transferItem, setTransferItem] = React.useState('');
  const [transferQuantity, setTransferQuantity] = React.useState('');
  const [transferId, setTransferId] = React.useState<string | null>(null);
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [transferPending, setTransferPending] = React.useState(false);

  const [countWarehouse, setCountWarehouse] = React.useState('');
  const [countDate, setCountDate] = React.useState(today());
  const [countItem, setCountItem] = React.useState('');
  const [countQuantity, setCountQuantity] = React.useState('');
  const [countId, setCountId] = React.useState<string | null>(null);
  const [countError, setCountError] = React.useState<string | null>(null);
  const [countPending, setCountPending] = React.useState(false);

  async function handleReceiptSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReceiptPending(true);
    setReceiptError(null);
    setReceiptId(null);

    try {
      const result = await createGoodsReceipt({
        warehouseId: receiptWarehouse,
        vendorId: receiptVendor || undefined,
        receiptDate,
        referenceNumber: receiptReference || undefined,
        lines: [
          {
            stockItemId: receiptItem,
            quantity: positiveNumber(receiptQuantity, 'Quantity'),
            unitCost: nonNegativeNumber(receiptUnitCost, 'Unit cost'),
          },
        ],
      });

      if (result.ok) {
        setReceiptId(result.id ?? null);
      } else {
        setReceiptError(result.error ?? 'Failed to create goods receipt.');
      }
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Failed to create goods receipt.');
    } finally {
      setReceiptPending(false);
    }
  }

  async function handleReceiptPost() {
    if (!receiptId) return;

    setReceiptPending(true);
    setReceiptError(null);

    try {
      const result = await postGoodsReceipt(receiptId);

      if (result.ok) {
        setReceiptId(null);
        router.refresh();
      } else {
        setReceiptError(result.error ?? 'Failed to post goods receipt.');
      }
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Failed to post goods receipt.');
    } finally {
      setReceiptPending(false);
    }
  }

  async function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssuePending(true);
    setIssueError(null);
    setIssueId(null);

    try {
      const result = await createMaterialIssue({
        warehouseId: issueWarehouse,
        projectId: issueProject || undefined,
        costCenterId: issueCostCenter || undefined,
        issueDate,
        purpose: issuePurpose || undefined,
        lines: [
          {
            stockItemId: issueItem,
            quantity: positiveNumber(issueQuantity, 'Quantity'),
          },
        ],
      });

      if (result.ok) {
        setIssueId(result.id ?? null);
      } else {
        setIssueError(result.error ?? 'Failed to create material issue.');
      }
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : 'Failed to create material issue.');
    } finally {
      setIssuePending(false);
    }
  }

  async function handleIssuePost() {
    if (!issueId) return;

    setIssuePending(true);
    setIssueError(null);

    try {
      const result = await postMaterialIssue(issueId);

      if (result.ok) {
        setIssueId(null);
        router.refresh();
      } else {
        setIssueError(result.error ?? 'Failed to post material issue.');
      }
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : 'Failed to post material issue.');
    } finally {
      setIssuePending(false);
    }
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTransferPending(true);
    setTransferError(null);
    setTransferId(null);

    try {
      if (!transferFrom || !transferTo) {
        throw new Error('Select both source and destination warehouses.');
      }

      if (transferFrom === transferTo) {
        throw new Error('Source and destination warehouses must be different.');
      }

      const result = await createStockTransfer({
        fromWarehouseId: transferFrom,
        toWarehouseId: transferTo,
        transferDate,
        lines: [
          {
            stockItemId: transferItem,
            quantity: positiveNumber(transferQuantity, 'Quantity'),
          },
        ],
      });

      if (result.ok) {
        setTransferId(result.id ?? null);
      } else {
        setTransferError(result.error ?? 'Failed to create stock transfer.');
      }
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Failed to create stock transfer.');
    } finally {
      setTransferPending(false);
    }
  }

  async function handleTransferPost() {
    if (!transferId) return;

    setTransferPending(true);
    setTransferError(null);

    try {
      const result = await postStockTransfer(transferId);

      if (result.ok) {
        setTransferId(null);
        router.refresh();
      } else {
        setTransferError(result.error ?? 'Failed to post stock transfer.');
      }
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Failed to post stock transfer.');
    } finally {
      setTransferPending(false);
    }
  }

  async function handleCountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCountPending(true);
    setCountError(null);
    setCountId(null);

    try {
      const result = await createStockCount({
        warehouseId: countWarehouse,
        countDate,
        lines: [
          {
            stockItemId: countItem,
            countedQuantity: nonNegativeNumber(countQuantity, 'Counted quantity'),
          },
        ],
      });

      if (result.ok) {
        setCountId(result.id ?? null);
      } else {
        setCountError(result.error ?? 'Failed to create stock count.');
      }
    } catch (error) {
      setCountError(error instanceof Error ? error.message : 'Failed to create stock count.');
    } finally {
      setCountPending(false);
    }
  }

  async function handleCountPost() {
    if (!countId) return;

    setCountPending(true);
    setCountError(null);

    try {
      const result = await postStockCount(countId);

      if (result.ok) {
        setCountId(null);
        router.refresh();
      } else {
        setCountError(result.error ?? 'Failed to post stock count.');
      }
    } catch (error) {
      setCountError(error instanceof Error ? error.message : 'Failed to post stock count.');
    } finally {
      setCountPending(false);
    }
  }

  const buttonStyle = {
    display: 'flex',
    gap: tokens.space(3),
    marginTop: tokens.space(4),
  };

  return (
    <div>
      <Section title="Goods Receipt">
        <form onSubmit={handleReceiptSubmit}>
          <Select
            label="Warehouse"
            value={receiptWarehouse}
            onChange={(e) => setReceiptWarehouse(e.target.value)}
            options={warehouseOptions}
            required
          />

          <TextField
            label="Vendor ID (optional)"
            value={receiptVendor}
            onChange={(e) => setReceiptVendor(e.target.value)}
          />

          <TextField
            label="Receipt date"
            type="date"
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
            required
          />

          <TextField
            label="Reference number (optional)"
            value={receiptReference}
            onChange={(e) => setReceiptReference(e.target.value)}
          />

          <Select
            label="Stock item"
            value={receiptItem}
            onChange={(e) => setReceiptItem(e.target.value)}
            options={stockItemOptions}
            required
          />

          <TextField
            label="Quantity"
            type="number"
            min="0.0001"
            step="any"
            value={receiptQuantity}
            onChange={(e) => setReceiptQuantity(e.target.value)}
            required
          />

          <TextField
            label="Unit cost"
            type="number"
            min="0"
            step="any"
            value={receiptUnitCost}
            onChange={(e) => setReceiptUnitCost(e.target.value)}
            required
          />

          <div style={buttonStyle}>
            <Button type="submit" disabled={receiptPending}>
              {receiptPending ? 'Processing...' : 'Create Draft Receipt'}
            </Button>

            {receiptId && (
              <Button
                type="button"
                disabled={receiptPending}
                onClick={handleReceiptPost}
              >
                Post Receipt
              </Button>
            )}
          </div>

          <Result id={receiptId} error={receiptError} />
        </form>
      </Section>

      <Section title="Material Issue">
        <form onSubmit={handleIssueSubmit}>
          <Select
            label="Warehouse"
            value={issueWarehouse}
            onChange={(e) => setIssueWarehouse(e.target.value)}
            options={warehouseOptions}
            required
          />

          <TextField
            label="Project ID (optional)"
            value={issueProject}
            onChange={(e) => setIssueProject(e.target.value)}
          />

          <TextField
            label="Cost center ID (optional)"
            value={issueCostCenter}
            onChange={(e) => setIssueCostCenter(e.target.value)}
          />

          <TextField
            label="Issue date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />

          <TextField
            label="Purpose (optional)"
            value={issuePurpose}
            onChange={(e) => setIssuePurpose(e.target.value)}
          />

          <Select
            label="Stock item"
            value={issueItem}
            onChange={(e) => setIssueItem(e.target.value)}
            options={stockItemOptions}
            required
          />

          <TextField
            label="Quantity"
            type="number"
            min="0.0001"
            step="any"
            value={issueQuantity}
            onChange={(e) => setIssueQuantity(e.target.value)}
            required
          />

          <div style={buttonStyle}>
            <Button type="submit" disabled={issuePending}>
              {issuePending ? 'Processing...' : 'Create Draft Issue'}
            </Button>

            {issueId && (
              <Button
                type="button"
                disabled={issuePending}
                onClick={handleIssuePost}
              >
                Post Issue
              </Button>
            )}
          </div>

          <Result id={issueId} error={issueError} />
        </form>
      </Section>

      <Section title="Stock Transfer">
        <form onSubmit={handleTransferSubmit}>
          <Select
            label="Source warehouse"
            value={transferFrom}
            onChange={(e) => setTransferFrom(e.target.value)}
            options={warehouseOptions}
            required
          />

          <Select
            label="Destination warehouse"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            options={warehouseOptions}
            required
          />

          <TextField
            label="Transfer date"
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            required
          />

          <Select
            label="Stock item"
            value={transferItem}
            onChange={(e) => setTransferItem(e.target.value)}
            options={stockItemOptions}
            required
          />

          <TextField
            label="Quantity"
            type="number"
            min="0.0001"
            step="any"
            value={transferQuantity}
            onChange={(e) => setTransferQuantity(e.target.value)}
            required
          />

          <div style={buttonStyle}>
            <Button type="submit" disabled={transferPending}>
              {transferPending ? 'Processing...' : 'Create Draft Transfer'}
            </Button>

            {transferId && (
              <Button
                type="button"
                disabled={transferPending}
                onClick={handleTransferPost}
              >
                Post Transfer
              </Button>
            )}
          </div>

          <Result id={transferId} error={transferError} />
        </form>
      </Section>

      <Section title="Stock Count">
        <form onSubmit={handleCountSubmit}>
          <Select
            label="Warehouse"
            value={countWarehouse}
            onChange={(e) => setCountWarehouse(e.target.value)}
            options={warehouseOptions}
            required
          />

          <TextField
            label="Count date"
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            required
          />

          <Select
            label="Stock item"
            value={countItem}
            onChange={(e) => setCountItem(e.target.value)}
            options={stockItemOptions}
            required
          />

          <TextField
            label="Counted quantity"
            type="number"
            min="0"
            step="any"
            value={countQuantity}
            onChange={(e) => setCountQuantity(e.target.value)}
            required
          />

          <div style={buttonStyle}>
            <Button type="submit" disabled={countPending}>
              {countPending ? 'Processing...' : 'Create Draft Count'}
            </Button>

            {countId && (
              <Button
                type="button"
                disabled={countPending}
                onClick={handleCountPost}
              >
                Post Count
              </Button>
            )}
          </div>

          <Result id={countId} error={countError} />
        </form>
      </Section>
    </div>
  );
}
