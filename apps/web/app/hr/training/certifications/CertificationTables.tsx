'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Certification {
  id: string;
  employeeId: string;
  name: string;
  issuedBy?: string | null;
  issueDate: string;
  expiryDate?: string | null;
  certificateUrl?: string | null;
}

interface ExpiringCertification extends Certification {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SkillMatrixRow {
  employeeId: string;
  name: string;
  skills: {
    name: string;
    expiryDate?: string | null;
  }[];
}

function expiryTone(expiryDate?: string | null) {
  if (!expiryDate) return 'neutral' as const;

  const remaining =
    new Date(expiryDate).getTime() - Date.now();

  if (remaining < 0) return 'negative' as const;
  if (remaining <= 30 * 86_400_000) return 'warning' as const;
  return 'positive' as const;
}

export function TrainingCertificationsTable({
  rows,
}: {
  rows: Certification[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Certification' },
    { header: 'Issued by' },
    { header: 'Issue date' },
    { header: 'Expiry' },
    { header: 'Status' },
    { header: 'Certificate' },
  ];

  const tableRows: DataTableClientRow<Certification>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.name,
      row.issuedBy ?? '?',
      new Date(row.issueDate).toLocaleDateString(),
      row.expiryDate
        ? new Date(row.expiryDate).toLocaleDateString()
        : 'No expiry',
      <Badge
        key={row.id + '-status'}
        tone={expiryTone(row.expiryDate)}
      >
        {row.expiryDate
          ? new Date(row.expiryDate) < new Date()
            ? 'Expired'
            : 'Valid'
          : 'No expiry'}
      </Badge>,
      row.certificateUrl ? (
        <Link
          key={row.id + '-certificate'}
          href={row.certificateUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            color: tokens.color.textPrimary,
            textDecoration: 'none',
          }}
        >
          Open
        </Link>
      ) : (
        '?'
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No certifications recorded for this employee."
    />
  );
}

export function TrainingExpiringCertificationsTable({
  rows,
}: {
  rows: ExpiringCertification[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Certification' },
    { header: 'Expiry' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<ExpiringCertification>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        row.employee
          ? row.employee.firstName + ' ' + row.employee.lastName
          : row.employeeId,
        row.name,
        row.expiryDate
          ? new Date(row.expiryDate).toLocaleDateString()
          : '?',
        <Badge
          key={row.id + '-status'}
          tone={expiryTone(row.expiryDate)}
        >
          {row.expiryDate
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(row.expiryDate).getTime() - Date.now()) /
                    86_400_000,
                ),
              ) + ' day(s)'
            : '?'}
        </Badge>,
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No certifications are expiring within the next 30 days."
    />
  );
}

export function TrainingSkillMatrixTable({
  rows,
}: {
  rows: SkillMatrixRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Certifications / skills' },
  ];

  const tableRows: DataTableClientRow<SkillMatrixRow>[] =
    rows.map((row) => ({
      id: row.employeeId,
      data: row,
      cells: [
        row.name,
        row.skills.length === 0
          ? 'None recorded'
          : row.skills
              .map(
                (skill) =>
                  skill.name +
                  (skill.expiryDate
                    ? ' (expires ' +
                      new Date(skill.expiryDate).toLocaleDateString() +
                      ')'
                    : ''),
              )
              .join(', '),
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No active employees were returned for this entity."
    />
  );
}
