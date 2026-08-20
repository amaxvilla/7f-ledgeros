'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { DeactivatePlanControl } from './DeactivatePlanControl';

interface CommissionPlan {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  scope: 'GLOBAL' | 'PROJECT' | 'ESTATE' | 'UNIT' | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
  rate: string | number | null;
  fixedAmount: string | number | null;
  isReferral: boolean;
  isTiered: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  projectId: string | null;
  estateId: string | null;
  unitId: string | null;
  agentId: string | null;
}

const STATUS_TONE: Record<
  CommissionPlan['status'],
  'neutral' | 'positive' | 'warning' | 'negative'
> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
};

function scopeTarget(plan: CommissionPlan): string {
  if (plan.scope === 'GLOBAL') return '—';
  return plan.projectId || plan.estateId || plan.unitId || plan.agentId || '—';
}

function rateDisplay(plan: CommissionPlan): string {
  if (plan.isTiered) return 'Tiered';
  if (plan.type === 'PERCENTAGE') {
    return plan.rate != null ? `${plan.rate}%` : '—';
  }
  return plan.fixedAmount != null ? String(plan.fixedAmount) : '—';
}

export function CommissionPlansTable({
  rows,
}: {
  rows: CommissionPlan[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Scope' },
    { header: 'Target' },
    { header: 'Rate / Amount' },
    { header: 'Referral' },
    { header: 'Effective from' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<CommissionPlan>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.code} ${row.name} ${row.type} ${row.scope} ${scopeTarget(row)} ${rateDisplay(row)} ${row.status}`,
    filterValues: [row.status, row.scope],
    cells: [
      (
        <Link
          key={`${row.id}-code`}
          href={`/commission-plans/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          {row.code}
        </Link>
      ),
      row.name,
      row.type,
      row.scope,
      scopeTarget(row),
      rateDisplay(row),
      row.isReferral ? 'Yes' : 'No',
      new Date(row.effectiveFrom).toLocaleDateString(),
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status]}
        >
          {row.status}
        </Badge>
      ),
      (
        <DeactivatePlanControl
          key={`${row.id}-actions`}
          planId={row.id}
          status={row.status}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No commission plans configured for this entity yet."
      search={{
        placeholder: 'Search code, name…',
      }}
      filters={[
        {
          label: 'Status',
          options: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        },
        {
          label: 'Scope',
          options: [
            { value: 'GLOBAL', label: 'Global' },
            { value: 'PROJECT', label: 'Project' },
            { value: 'ESTATE', label: 'Estate' },
            { value: 'UNIT', label: 'Unit' },
            { value: 'AGENT', label: 'Agent' },
          ],
        },
      ]}
    />
  );
}
