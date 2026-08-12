import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateProjectForm } from './CreateProjectForm';
import { CreateVendorForm } from './CreateVendorForm';
import { CreateCustomerForm } from './CreateCustomerForm';

export const dynamic = 'force-dynamic';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  isActive: boolean;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  isActive: boolean;
}

/**
 * Frontend Completion, FE-3.2 — Dimensions, second checkpoint of Stage
 * FE-3. See `actions.ts`'s own doc comment for why this page scopes to
 * exactly Projects/Vendors/Customers out of `DimensionsController`'s
 * eight sub-resources.
 *
 * Projects is entity-scoped (`GET /dimensions/projects?entityId=`) and
 * gated behind `EntitySelector`, the same shape Budgeting/AP-AR use.
 * Vendors and Customers are shared reference data with no `entityId`
 * filter on their own list endpoints (`GET /dimensions/vendors`,
 * `GET /dimensions/customers` both take no query params at all,
 * confirmed directly) — fetched unconditionally, same as the Chart of
 * Accounts / Tax Codes tables' own "ungated, shared" render condition
 * (see `general-ledger/page.tsx`'s and `tax/page.tsx`'s own doc
 * comments).
 *
 * ADDENDUM (FE-4.13) — the Customers table now also has a "Statement"
 * link per row, to the new `/real-estate/customers/[customerId]/statement`
 * page (Real Estate's own Customer Statement view) — the same
 * Code-column-as-`Link` precedent other registers in this app already
 * use, here as a dedicated Actions column instead since Code itself
 * has no detail page of its own on THIS module.
 */
export default async function DimensionsPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let projects: Project[] | null = null;
  let projectsError: string | null = null;
  if (entityId) {
    try {
      projects = await fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`);
    } catch (e) {
      projectsError = e instanceof ApiError ? e.message : 'Failed to load projects.';
    }
  }

  let vendors: Vendor[] | null = null;
  let vendorsError: string | null = null;
  try {
    vendors = await fetchApi<Vendor[]>('/dimensions/vendors');
  } catch (e) {
    vendorsError = e instanceof ApiError ? e.message : 'Failed to load vendors.';
  }

  let customers: Customer[] | null = null;
  let customersError: string | null = null;
  try {
    customers = await fetchApi<Customer[]>('/dimensions/customers');
  } catch (e) {
    customersError = e instanceof ApiError ? e.message : 'Failed to load customers.';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dimensions"
        subtitle="Shared reference data used across Finance, PMO, and Real Estate: projects, vendors, and customers."
      />
      <EntitySelector initialValue={entityId} />

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Projects" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to manage its projects.'} />
        {entityId && (
          <>
            <CreateProjectForm entityId={entityId} />
            {projectsError && (
              <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
                {projectsError}
              </div>
            )}
            {projects && (
              <DataTable
                columns={[
                  { header: 'Code', render: (p: Project) => p.code },
                  { header: 'Name', render: (p: Project) => p.name },
                  { header: 'Description', render: (p: Project) => p.description ?? '—' },
                  { header: 'Status', render: (p: Project) => <Badge tone={p.isActive ? 'positive' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
                ]}
                rows={projects}
                keyOf={(p) => p.id}
                emptyMessage="No projects for this entity yet."
              />
            )}
          </>
        )}
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Vendors" subtitle="Shared reference data — not entity-specific." />
        <CreateVendorForm />
        {vendorsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {vendorsError}
          </div>
        )}
        {vendors && (
          <DataTable
            columns={[
              { header: 'Code', render: (v: Vendor) => v.code },
              { header: 'Name', render: (v: Vendor) => v.name },
              { header: 'Tax ID', render: (v: Vendor) => v.taxId ?? '—' },
              { header: 'Status', render: (v: Vendor) => <Badge tone={v.isActive ? 'positive' : 'neutral'}>{v.isActive ? 'Active' : 'Inactive'}</Badge> },
            ]}
            rows={vendors}
            keyOf={(v) => v.id}
            emptyMessage="No vendors configured yet."
          />
        )}
      </section>

      <section>
        <PageHeader title="Customers" subtitle="Shared reference data — not entity-specific." />
        <CreateCustomerForm />
        {customersError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {customersError}
          </div>
        )}
        {customers && (
          <DataTable
            columns={[
              { header: 'Code', render: (c: Customer) => c.code },
              { header: 'Name', render: (c: Customer) => c.name },
              { header: 'Email', render: (c: Customer) => c.email ?? '—' },
              { header: 'Status', render: (c: Customer) => <Badge tone={c.isActive ? 'positive' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
              {
                header: 'Actions',
                align: 'right',
                render: (c: Customer) => (
                  <Link href={`/real-estate/customers/${c.id}/statement`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                    Statement
                  </Link>
                ),
              },
            ]}
            rows={customers}
            keyOf={(c) => c.id}
            emptyMessage="No customers configured yet."
          />
        )}
      </section>
    </PageContainer>
  );
}
