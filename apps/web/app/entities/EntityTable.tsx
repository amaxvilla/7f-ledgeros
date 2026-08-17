'use client';

import Link from 'next/link';
import {
  Badge,
  DataTableClient,
  tokens,
} from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { DeactivateEntityButton } from './DeactivateEntityButton';
import { BulkDeactivateEntitiesButton } from './BulkDeactivateEntitiesButton';

interface EntityRow {
  id: string;
  code: string;
  name: string;
  legalName: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  isActive: boolean;
  isConsolidationParent: boolean;
  parentEntityId: string | null;
  subsidiaries: { id: string }[];
}

interface EntityTableProps {
  entities: EntityRow[];
  parentById: Map<string, string>;
}

export function EntityTable({
  entities,
  parentById,
}: EntityTableProps) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Legal name' },
    { header: 'Parent' },
    { header: 'Currency' },
    { header: 'Subsidiaries', align: 'right' },
    { header: 'Consolidation parent' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const rows: DataTableClientRow<EntityRow>[] = entities.map((e) => ({
    id: e.id,
    data: e,
    cells: [
      <Link
        key={`${e.id}-code`}
        href={`/entities/${e.id}`}
        style={{
          color: tokens.color.accent,
          fontFamily: tokens.font.body,
          fontSize: '13px',
        }}
      >
        {e.code}
      </Link>,
      e.name,
      e.legalName,
      e.parentEntityId
        ? (parentById.get(e.parentEntityId) ?? e.parentEntityId)
        : '—',
      e.baseCurrency,
      String(e.subsidiaries.length),
      e.isConsolidationParent ? (
        <Badge key={`${e.id}-parent`} tone="positive">
          Yes
        </Badge>
      ) : (
        '—'
      ),
      <Badge
        key={`${e.id}-status`}
        tone={e.isActive ? 'positive' : 'neutral'}
      >
        {e.isActive ? 'Active' : 'Inactive'}
      </Badge>,
      <DeactivateEntityButton
        key={`${e.id}-actions`}
        id={e.id}
        isActive={e.isActive}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      emptyMessage="No entities configured yet."
      bulkActions={{
        renderActions: (selectedRows, clearSelection) => (
          <BulkDeactivateEntitiesButton
            entities={selectedRows}
            onDone={clearSelection}
          />
        ),
      }}
    />
  );
}
