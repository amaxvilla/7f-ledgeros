import Link from 'next/link';
import { PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateProjectForm } from './CreateProjectForm';
import { CreateVendorForm } from './CreateVendorForm';
import { CreateCustomerForm } from './CreateCustomerForm';
import { DimensionsProjectsTable, DimensionsVendorsTable, DimensionsCustomersTable } from './DimensionsTables';

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
              <DimensionsProjectsTable rows={projects} />
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
          <DimensionsVendorsTable rows={vendors} />
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
          <DimensionsCustomersTable rows={customers} />
        )}
      </section>
    </PageContainer>
  );
}
