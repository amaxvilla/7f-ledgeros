'use client';

import {
  Badge,
  DataTableClient,
  tokens,
} from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { formatCurrency } from '../../lib/format';
import { AllocationActions } from './AllocationActions';

export interface Resource {
  id: string;
  projectId: string;
  entityId: string;
  type: 'LABOUR' | 'EQUIPMENT';
  name: string;
  code: string | null;
  unitOfMeasure: string | null;
  unitCost: number | string | null;
  capacity: number | string | null;
  isActive: boolean;
}

export interface UtilizationRow {
  resourceId: string;
  name: string;
  type: 'LABOUR' | 'EQUIPMENT';
  capacity: number | string | null;
  committed: number | string;
  utilizationPct: number | null;
}

export interface ProjectTask {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

export interface Allocation {
  id: string;
  resourceId: string;
  taskId: string;
  entityId: string;
  startDate: string;
  endDate: string;
  plannedQuantity: number | string;
  actualQuantity: number | string | null;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  resource: Resource;
  task: ProjectTask;
}

interface ProjectResourcesTablesProps {
  resources: Resource[];
  utilization: UtilizationRow[];
  allocations: Allocation[];
}

const RESOURCE_TONE: Record<
  Resource['type'],
  'positive' | 'warning' | 'neutral'
> = {
  LABOUR: 'positive',
  EQUIPMENT: 'warning',
};

const ALLOCATION_TONE: Record<
  Allocation['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PLANNED: 'neutral',
  ACTIVE: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

export function ProjectResourcesTables({
  resources,
  utilization,
  allocations,
}: ProjectResourcesTablesProps) {
  const utilizationColumns: DataTableClientColumn[] = [
    { header: 'Resource' },
    { header: 'Type' },
    { header: 'Capacity', align: 'right' },
    { header: 'Committed', align: 'right' },
    { header: 'Utilization', align: 'right' },
  ];

  const utilizationRows: DataTableClientRow<UtilizationRow>[] =
    utilization.map((row) => ({
      id: row.resourceId,
      data: row,
      cells: [
        row.name,
        <Badge
          key={`${row.resourceId}-type`}
          tone={RESOURCE_TONE[row.type]}
        >
          {row.type}
        </Badge>,
        row.capacity == null ? '—' : String(row.capacity),
        String(row.committed),
        row.utilizationPct == null
          ? '—'
          : `${row.utilizationPct}%`,
      ],
    }));

  const resourceColumns: DataTableClientColumn[] = [
    { header: 'Resource' },
    { header: 'Code' },
    { header: 'Type' },
    { header: 'Unit cost', align: 'right' },
    { header: 'Capacity', align: 'right' },
    { header: 'Status' },
  ];

  const resourceRows: DataTableClientRow<Resource>[] =
    resources.map((resource) => ({
      id: resource.id,
      data: resource,
      cells: [
        resource.name,
        resource.code ?? '—',
        <Badge
          key={`${resource.id}-type`}
          tone={RESOURCE_TONE[resource.type]}
        >
          {resource.type}
        </Badge>,
        resource.unitCost == null
          ? '—'
          : formatCurrency(Number(resource.unitCost)),
        resource.capacity == null
          ? '—'
          : String(resource.capacity),
        <Badge
          key={`${resource.id}-status`}
          tone={resource.isActive ? 'positive' : 'neutral'}
        >
          {resource.isActive ? 'Active' : 'Inactive'}
        </Badge>,
      ],
    }));

  const allocationColumns: DataTableClientColumn[] = [
    { header: 'Resource' },
    { header: 'Task' },
    { header: 'Start' },
    { header: 'End' },
    { header: 'Planned', align: 'right' },
    { header: 'Actual', align: 'right' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const allocationRows: DataTableClientRow<Allocation>[] =
    allocations.map((allocation) => ({
      id: allocation.id,
      data: allocation,
      cells: [
        allocation.resource?.name ?? allocation.resourceId,
        allocation.task?.name ?? allocation.taskId,
        new Date(allocation.startDate).toLocaleDateString(),
        new Date(allocation.endDate).toLocaleDateString(),
        String(allocation.plannedQuantity),
        allocation.actualQuantity == null
          ? '—'
          : String(allocation.actualQuantity),
        <Badge
          key={`${allocation.id}-status`}
          tone={ALLOCATION_TONE[allocation.status]}
        >
          {allocation.status}
        </Badge>,
        <AllocationActions
          key={`${allocation.id}-actions`}
          id={allocation.id}
          status={allocation.status}
        />,
      ],
    }));

  return (
    <>
      <DataTableClient
        columns={utilizationColumns}
        rows={utilizationRows}
        emptyMessage="No active resources for this project."
      />

      <section style={{ marginTop: tokens.space(8) }}>
        <DataTableClient
          columns={resourceColumns}
          rows={resourceRows}
          emptyMessage="No resources registered for this project."
        />
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <DataTableClient
          columns={allocationColumns}
          rows={allocationRows}
          emptyMessage="No allocations for this project."
        />
      </section>
    </>
  );
}
