'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { useMemo, useState } from 'react';
import { TitleDeedActions } from './[parcelId]/TitleDeedActions';
import { SurveyPlanActions } from './[parcelId]/SurveyPlanActions';
import { PlotReleaseActions } from './[parcelId]/PlotReleaseActions';
import { MasterPlanActions } from './estates/[estateId]/MasterPlanActions';

interface LandParcel {
  id: string;
  code: string;
  name: string;
  location: string | null;
  areaSqm: string | number;
  status: string;
  acquisitions: unknown[];
  titleDeeds: unknown[];
  surveyPlans: unknown[];
  plots: unknown[];
}

interface Estate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  projects: unknown[];
}

interface TitleDeed {
  id: string;
  parcelId: string;
  titleType: string;
  titleNumber: string | null;
  status: string;
  issuingAuthority: string | null;
  applicationDate: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentRef: string | null;
  notes: string | null;
}

interface SurveyPlan {
  id: string;
  parcelId: string;
  planNumber: string;
  surveyorName: string | null;
  surveyDate: string | null;
  areaSqm: string | number | null;
  documentRef: string | null;
  status: string;
}

interface PlotRelease {
  projectId: string;
  releaseDate: string;
  notes: string | null;
  cancelledAt: string | null;
}

interface Plot {
  id: string;
  plotNumber: string;
  areaSqm: string | number;
  useType: string;
  status: string;
  notes: string | null;
  release: PlotRelease | null;
}

interface MasterPlanZone {
  id: string;
  code: string;
  name: string;
  useType: string;
  plannedAreaSqm: string | number | null;
  plannedUnitCount: number | null;
}

interface MasterPlan {
  id: string;
  estateId: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  summary: string | null;
  totalPlannedUnits: number | null;
  approvedAt: string | null;
  zones: MasterPlanZone[];
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  AVAILABLE: 'neutral',
  UNDER_ACQUISITION: 'warning',
  ACQUIRED: 'positive',
  IN_TITLING: 'warning',
  TITLED: 'positive',
  SURVEYED: 'positive',
  SUBDIVIDED: 'positive',
  DEVELOPED: 'positive',
  DISPOSED: 'negative',
};

const TITLE_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'warning',
  PERFECTED: 'positive',
  REJECTED: 'negative',
  EXPIRED: 'warning',
};

const TITLE_TYPE_LABEL: Record<string, string> = {
  CERTIFICATE_OF_OCCUPANCY: 'Certificate of Occupancy',
  DEED_OF_ASSIGNMENT: 'Deed of Assignment',
  GOVERNORS_CONSENT: "Governor's Consent",
  GAZETTE: 'Gazette',
  FREEHOLD: 'Freehold',
  LEASEHOLD: 'Leasehold',
  OTHER: 'Other',
};

const SURVEY_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
};

const PLOT_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PLANNED: 'neutral',
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  SOLD: 'positive',
};

const PLOT_USE_TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  MIXED_USE: 'Mixed use',
  INDUSTRIAL: 'Industrial',
  AGRICULTURAL: 'Agricultural',
};

const MASTER_PLAN_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  APPROVED: 'positive',
  SUPERSEDED: 'warning',
};

export function LandParcelsTable({
  rows,
}: {
  rows: LandParcel[];
}) {
  const [status, setStatus] = useState('ALL');

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      status === 'ALL'
        ? rows
        : rows.filter((row) => row.status === status),
    [rows, status],
  );

  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Location' },
    { header: 'Area (sqm)', align: 'right' },
    { header: 'Status' },
    { header: 'Acquisitions', align: 'right' },
    { header: 'Titles', align: 'right' },
    { header: 'Survey plans', align: 'right' },
    { header: 'Plots', align: 'right' },
    { header: 'View', align: 'right' },
  ];

  const tableRows: DataTableClientRow<LandParcel>[] = filteredRows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        row.code,
        row.name,
        row.location ?? '—',
        String(row.areaSqm),
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>,
        String(row.acquisitions.length),
        String(row.titleDeeds.length),
        String(row.surveyPlans.length),
        String(row.plots.length),
        <Link
          key={`${row.id}-view`}
          href={`/land-bank/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          Titles →
        </Link>,
      ],
    }),
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space(3),
          marginBottom: tokens.space(4),
        }}
      >
        <label
          htmlFor="land-bank-status-filter"
          style={{
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: tokens.color.textMuted,
          }}
        >
          Status
        </label>

        <select
          id="land-bank-status-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          style={{
            minHeight: '36px',
            border: `1px solid ${tokens.color.border}`,
            borderRadius: '6px',
            padding: '0 10px',
            fontFamily: tokens.font.body,
            fontSize: '13px',
            background: tokens.color.surface,
            color: tokens.color.textPrimary,
          }}
        >
          <option value="ALL">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <DataTableClient
        columns={columns}
        rows={tableRows}
        emptyMessage="No land parcels for this entity yet."
      />
    </div>
  );
}

export function EstatesTable({
  rows,
}: {
  rows: Estate[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Location' },
    { header: 'Description' },
    { header: 'Projects', align: 'right' },
    { header: 'View', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Estate>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.location ?? '—',
      row.description ?? '—',
      String(row.projects.length),
      <Link
        key={`${row.id}-view`}
        href={`/land-bank/estates/${row.id}`}
        style={{
          color: tokens.color.accent,
          fontFamily: tokens.font.body,
          fontSize: '13px',
        }}
      >
        Master plans →
      </Link>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No estates for this entity yet."
    />
  );
}

export function TitleDeedsTable({
  rows,
  parcelId,
}: {
  rows: TitleDeed[];
  parcelId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Type' },
    { header: 'Title #' },
    { header: 'Issuing authority' },
    { header: 'Issued' },
    { header: 'Expiry' },
    { header: 'Status' },
    { header: 'Notes' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<TitleDeed>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      TITLE_TYPE_LABEL[row.titleType] ?? row.titleType,
      row.titleNumber ?? '—',
      row.issuingAuthority ?? '—',
      row.issuedDate
        ? new Date(row.issuedDate).toLocaleDateString()
        : '—',
      row.expiryDate
        ? new Date(row.expiryDate).toLocaleDateString()
        : '—',
      <Badge
        key={`${row.id}-status`}
        tone={TITLE_STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      row.notes ?? '—',
      <TitleDeedActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
        parcelId={parcelId}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No title deeds recorded for this parcel yet."
    />
  );
}

export function SurveyPlansTable({
  rows,
  parcelId,
}: {
  rows: SurveyPlan[];
  parcelId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Plan #' },
    { header: 'Surveyor' },
    { header: 'Survey date' },
    { header: 'Area (sqm)', align: 'right' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<SurveyPlan>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.planNumber,
      row.surveyorName ?? '—',
      row.surveyDate
        ? new Date(row.surveyDate).toLocaleDateString()
        : '—',
      row.areaSqm != null ? String(row.areaSqm) : '—',
      <Badge
        key={`${row.id}-status`}
        tone={SURVEY_STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      <SurveyPlanActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
        parcelId={parcelId}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No survey plans recorded for this parcel yet."
    />
  );
}

export function PlotsTable({
  rows,
  parcelId,
  projectOptions,
}: {
  rows: Plot[];
  parcelId: string;
  projectOptions: Array<{ value: string; label: string }>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Plot #' },
    { header: 'Area (sqm)', align: 'right' },
    { header: 'Use type' },
    { header: 'Status' },
    { header: 'Notes' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Plot>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.plotNumber,
      String(row.areaSqm),
      PLOT_USE_TYPE_LABEL[row.useType] ?? row.useType,
      <Badge
        key={`${row.id}-status`}
        tone={PLOT_STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      row.notes ?? '—',
      <PlotReleaseActions
        key={`${row.id}-actions`}
        plotId={row.id}
        status={row.status}
        parcelId={parcelId}
        projectOptions={projectOptions}
        release={row.release && !row.release.cancelledAt ? row.release : null}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This parcel has not been subdivided into plots yet."
    />
  );
}

export function MasterPlansTable({
  rows,
  estateId,
}: {
  rows: MasterPlan[];
  estateId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Version' },
    { header: 'Summary' },
    { header: 'Total planned units', align: 'right' },
    { header: 'Zones' },
    { header: 'Status' },
    { header: 'Approved' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<MasterPlan>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      `v${row.version}`,
      row.summary ?? '—',
      row.totalPlannedUnits != null
        ? String(row.totalPlannedUnits)
        : '—',
      row.zones.length === 0
        ? '—'
        : row.zones
            .map(
              (zone) =>
                `${zone.code} (${PLOT_USE_TYPE_LABEL[zone.useType] ?? zone.useType})`,
            )
            .join(', '),
      <Badge
        key={`${row.id}-status`}
        tone={MASTER_PLAN_STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      row.approvedAt
        ? new Date(row.approvedAt).toLocaleDateString()
        : '—',
      <MasterPlanActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
        estateId={estateId}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No master plans for this estate yet."
    />
  );
}
