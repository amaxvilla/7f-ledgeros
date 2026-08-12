import { DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';

export const dynamic = 'force-dynamic';

interface SearchResultItem {
  id: string;
  type: 'customer' | 'vendor' | 'employee' | 'project' | 'account';
  title: string;
  subtitle?: string;
  href: string;
}

interface SearchResults {
  query: string;
  categories: {
    customers: SearchResultItem[];
    vendors: SearchResultItem[];
    employees: SearchResultItem[];
    projects: SearchResultItem[];
    accounts: SearchResultItem[];
  };
}

const CATEGORY_LABELS: Record<keyof SearchResults['categories'], string> = {
  customers: 'Customers',
  vendors: 'Vendors',
  employees: 'Employees',
  projects: 'Projects',
  accounts: 'GL Accounts',
};

async function loadResults(q: string, entityId?: string) {
  const params = new URLSearchParams({ q });
  if (entityId) params.set('entityId', entityId);
  return fetchApi<SearchResults>(`/search?${params.toString()}`);
}

/**
 * FE-1.7 — Search, the last-but-one of FE-1's four originally-named
 * gaps (Sidebar/Theme closed by FE-1.5/FE-1.6; Settings remains open).
 * See `SearchService`'s own doc comment (apps/api/src/search) for the
 * full backend scoping rationale — this page is pure delegation to that
 * one new endpoint, no new aggregation logic of its own.
 *
 * `q` is the only required param (a plain `?q=` querystring, submitted
 * by AppShell's new header form via a native GET — no client JS
 * anywhere on this page). `entityId` is optional and only narrows the
 * Employees/Projects categories (see the backend's own doc comment for
 * why: Customer/Vendor/Account are global master data with no
 * `entityId` column in this schema) — exposed here via the same
 * `EntitySelector` every other entity-scoped page already uses, not a
 * required gate the way CRM/HR/etc. treat it, since three of five
 * categories work perfectly well without one.
 *
 * Known, named rough edge (not fixed here — out of scope for this
 * checkpoint's own "smallest correct version" bar): `EntitySelector`'s
 * own GET form submits only its own `entityId` field, dropping this
 * page's `q` param on submit (confirmed directly by reading that
 * component — it has no hidden-field extension point for a second
 * param). Re-entering the entity ID after already searching means
 * losing the query string until `EntitySelector` grows a way to carry
 * extra hidden fields — a small, real, separate follow-up, not
 * something worth widening a shared component for on this checkpoint's
 * own account alone.
 *

 * Categories the backend silently omitted (no permission for that
 * category) render as empty sections here, not as an error — same
 * "reflect what the backend actually returned" discipline this app's
 * other pages already follow for optional/absent data.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; entityId?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const entityId = searchParams.entityId;

  if (!q) {
    return (
      <PageContainer>
        <PageHeader title="Search" subtitle="Enter a search term using the box in the header above." />
      </PageContainer>
    );
  }

  let data: SearchResults | null = null;
  let error: string | null = null;
  try {
    data = await loadResults(q, entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to run search.';
  }

  const totalResults = data
    ? Object.values(data.categories).reduce((sum, rows) => sum + rows.length, 0)
    : 0;

  return (
    <PageContainer>
      <PageHeader title="Search" subtitle={`Results for "${q}"`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && totalResults === 0 && !error && (
        <p style={{ fontFamily: tokens.font.body, color: tokens.color.textMuted }}>
          No results. Employees and Projects only search within the selected entity — try selecting an entity above,
          or you may not hold the view permission for a given category.
        </p>
      )}

      {data &&
        (Object.keys(CATEGORY_LABELS) as (keyof SearchResults['categories'])[]).map((key) => {
          const rows = data!.categories[key];
          if (rows.length === 0) return null;
          return (
            <section key={key} style={{ marginBottom: tokens.space(8) }}>
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
              <DataTable
                columns={[
                  {
                    header: 'Name',
                    render: (row: SearchResultItem) => (
                      <a href={row.href} style={{ color: tokens.color.accent, textDecoration: 'none' }}>
                        {row.title}
                      </a>
                    ),
                  },
                  { header: 'Code', render: (row: SearchResultItem) => row.subtitle ?? '—' },
                ]}
                rows={rows}
                keyOf={(row) => row.id}
              />
            </section>
          );
        })}
    </PageContainer>
  );
}
