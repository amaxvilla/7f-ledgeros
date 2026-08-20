'use client';

import { DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface SearchResultItem {
  id: string;
  type: 'customer' | 'vendor' | 'employee' | 'project' | 'account';
  title: string;
  subtitle?: string;
  href: string;
}

type SearchCategoryKey =
  | 'customers'
  | 'vendors'
  | 'employees'
  | 'projects'
  | 'accounts';

interface SearchCategories {
  customers: SearchResultItem[];
  vendors: SearchResultItem[];
  employees: SearchResultItem[];
  projects: SearchResultItem[];
  accounts: SearchResultItem[];
}

const CATEGORY_LABELS: Record<SearchCategoryKey, string> = {
  customers: 'Customers',
  vendors: 'Vendors',
  employees: 'Employees',
  projects: 'Projects',
  accounts: 'GL Accounts',
};

export function SearchResultsTables({
  categories,
}: {
  categories: SearchCategories;
}) {
  const keys: SearchCategoryKey[] = [
    'customers',
    'vendors',
    'employees',
    'projects',
    'accounts',
  ];

  return (
    <>
      {keys.map((key) => {
        const rows = categories[key];

        if (rows.length === 0) {
          return null;
        }

        const columns: DataTableClientColumn[] = [
          { header: 'Name' },
          { header: 'Code' },
        ];

        const tableRows: DataTableClientRow<SearchResultItem>[] = rows.map(
          (row) => ({
            id: row.id,
            data: row,
            searchText: `${row.title} ${row.subtitle ?? ''} ${row.type}`,
            cells: [
              (
                <a
                  key={`${row.id}-name`}
                  href={row.href}
                  style={{
                    color: tokens.color.accent,
                    textDecoration: 'none',
                    fontFamily: tokens.font.body,
                    fontSize: '13px',
                  }}
                >
                  {row.title}
                </a>
              ),
              row.subtitle ?? '—',
            ],
          }),
        );

        return (
          <section
            key={key}
            style={{ marginBottom: tokens.space(8) }}
          >
            <h2
              style={{
                fontFamily: tokens.font.display,
                fontSize: '15px',
                color: tokens.color.textPrimary,
                marginBottom: tokens.space(2),
              }}
            >
              {CATEGORY_LABELS[key]}
            </h2>

            <DataTableClient
              columns={columns}
              rows={tableRows}
              emptyMessage={`No ${CATEGORY_LABELS[key].toLowerCase()} found.`}
              search={{
                placeholder: `Search ${CATEGORY_LABELS[key].toLowerCase()}…`,
              }}
            />
          </section>
        );
      })}
    </>
  );
}
