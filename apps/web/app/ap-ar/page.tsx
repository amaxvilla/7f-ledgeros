import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateAPInvoiceForm } from './CreateAPInvoiceForm';
import { CreateARInvoiceForm } from './CreateARInvoiceForm';
import { PostAPInvoiceButton } from './PostAPInvoiceButton';
import { PostARInvoiceButton } from './PostARInvoiceButton';
import { CreatePaymentBatchForm } from './CreatePaymentBatchForm';
import { ImportPaymentBatchForm } from './ImportPaymentBatchForm';
import { PaymentBatchActions } from './PaymentBatchActions';
import { CreatePaymentVoucherForm } from './CreatePaymentVoucherForm';
import { PaymentVoucherActions } from './PaymentVoucherActions';
import { CashForecastTable, APInvoiceTable, ARInvoiceTable } from './ApArTables';

export const dynamic = 'force-dynamic';

interface OutstandingPayablesReceivables {
  payables: { total: number; invoiceCount: number };
  receivables: { total: number; invoiceCount: number };
  netPosition: number;
}

interface CashForecastHorizon {
  days: number;
  outflow: number;
  inflow: number;
  net: number;
}

interface CashForecast {
  horizons: CashForecastHorizon[];
}

interface APInvoiceLine {
  quantity: number;
  unitCost: number;
}

interface APInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  purchaseOrderId: string | null;
  lines: APInvoiceLine[];
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface ARInvoiceLine {
  quantity: number;
  unitPrice: number;
}

interface ARInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  lines: ARInvoiceLine[];
}

interface Customer {
  id: string;
  code: string;
  name: string;
}

const AP_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_MATCH: 'warning',
  MATCHED: 'warning',
  MATCHED_WITH_VARIANCE: 'negative',
  POSTED: 'positive',
  CANCELLED: 'negative',
};

// Frontend Completion, AR.2 — `ARInvoiceStatus` (confirmed directly
// against the schema) has only three values, unlike AP's seven-value
// matching workflow, so this map is correspondingly smaller.
const AR_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  POSTED: 'positive',
  CANCELLED: 'negative',
};

/**
 * Frontend Completion — AP/AR.1, the nineteenth Module Page/nav link.
 * Picked directly off Budgeting (BUD.2)'s own recommendation to
 * investigate Accounts Payable/Receivable next, per this session's own
 * "before coding" discipline: read both controllers before committing
 * to a shape, rather than assuming symmetry with Budgeting.
 *
 * That read turned up a genuinely different starting point than
 * Budgeting had: `GET /dashboard/outstanding-payables-receivables`
 * (confirmed directly against `DashboardService.getOutstandingPayablesReceivables`)
 * already aggregates BOTH `AccountsPayableService.getVendorAging` and
 * `AccountsReceivableService.getAging` into one response with a
 * genuinely combined `netPosition` figure (receivables − payables) —
 * this isn't two modules' data shown side by side for convenience, it's
 * one metric neither `ap.view` nor `ar.view` alone can produce.
 * `GET /dashboard/cash-forecast` (`getCashForecast`, confirmed the same
 * way) is built the same way: outflow (AP due) vs inflow (AR due) per
 * 30/60/90-day horizon. Both require only `ap.view` (confirmed against
 * their own `@RequirePermissions` decorators) despite touching AR data
 * too — read directly, not assumed, since that's the one permission
 * this page needs to gate on.
 *
 * Deliberately scoped to ONLY these two aggregates this checkpoint —
 * same "no DataTable because no list endpoint backs an aggregate
 * directly" reasoning SecurityPage's own doc comment gives, except here
 * list endpoints for the underlying records DO exist (`GET
 * /ap/invoices`, `GET /ar/invoices`, both confirmed present) but are
 * deliberately NOT wired in yet: an AP invoice register and an AR
 * invoice register are two more genuinely separate registries, each
 * with its own multi-line `Create*InvoiceDto` (the same
 * `ArrayMinSize(1)`-nested-lines shape `CreateBudgetForm` established a
 * pattern for) — building either one alongside this aggregate view
 * would be at least two checkpoints' worth of work on its own. This
 * checkpoint is the read-only "why does this number look the way it
 * does" cash-position view; AP.2 (invoice register + create) and AR.2
 * are named as the next two candidates, not attempted here.
 *
 * Route/nav label chosen as `/ap-ar` / "AP / AR" — matching the
 * backend's own `@Controller('ap')`/`@Controller('ar')` short names
 * directly, rather than a longer "Accounts Payable & Receivable" that
 * NAV_LINKS' own flat list (already at 18 entries) doesn't have room to
 * spell out comfortably.
 *
 * AP.2 adds the AP invoice register (`GET /ap/invoices?entityId=`) and
 * `CreateAPInvoiceForm` on this same page — same "create form inline on
 * the register page itself" placement every other module page uses
 * (Budgeting, Project Risks/Issues), not a separate `/ap-ar/invoices`
 * route. AR.2 (the same shape for `GET /ar/invoices`) is deliberately
 * NOT attempted in the same checkpoint — genuinely separate registry,
 * own `CreateARInvoiceDto` with its own optional per-line fields (see
 * AP/AR.1's own doc comment) worth its own scoping decision rather than
 * assumed symmetry with this one.
 *
 * ADDENDUM (AR.3): the direct AR mirror of AP.3's `PostAPInvoiceButton`
 * — `PostARInvoiceButton`, wired into a new "Actions" column on the AR
 * register, reusing `data.accountOptions` (no new fetch, confirmed the
 * same full active-accounts set works for `arControlAccountId` too).
 * `AccountsReceivableService.postInvoice` (read directly, not assumed
 * from AP's shape) has only the one `status !== DRAFT` gate — no
 * `purchaseOrderId`/Procurement concept exists on the AR side — so this
 * button has no second hidden-condition branch the way AP.3's does.
 *
 * ADDENDUM (AP.3): the recommended next row action after AR.2 —
 * `PostAPInvoiceButton`, wired into a new "Actions" column on the AP
 * register only (AR's own `postInvoice` mirror is deliberately not
 * attempted this checkpoint — a separate registry needing its own pass,
 * same discipline this file's own AR.2 addendum already applied in the
 * other direction). Reuses `data.accountOptions` (already fetched for
 * `CreateAPInvoiceForm`) rather than a new fetch. `purchaseOrderId`
 * added to this file's own `APInvoice` interface — Prisma's default
 * `findMany` already returned it on every row (confirmed against
 * `AccountsPayableService.listInvoices`'s unscoped `include`), it just
 * wasn't typed/used here yet — needed so `PostAPInvoiceButton` can hide
 * itself for PO-backed invoices, which `postInvoice` rejects server-side
 * with a real, distinct `BadRequestException` (not just a status check).
 *
 * ADDENDUM (AR.2): `CreateARInvoiceForm` and its `actions.ts` action
 * (`createARInvoice`) already existed in this ZIP from an earlier,
 * unfinished pass — not yet referenced by this page or documented in
 * any prior checkpoint report. This checkpoint is that wiring: `GET
 * /ar/invoices?entityId=` and `GET /dimensions/customers` added to this
 * page's own `Promise.all`, the AR register `DataTable` + form rendered
 * below the AP register (same placement precedent), and a test read for
 * `CreateARInvoiceForm.test.tsx` (already present, unmodified) to
 * confirm it mocks `../actions`' `createARInvoice` the same way
 * `CreateAPInvoiceForm.test.tsx` mocks `createAPInvoice`. `ARInvoiceStatus`
 * has only three values (`DRAFT`/`POSTED`/`CANCELLED`, confirmed against
 * the schema) — `AR_STATUS_TONE` is smaller than `AP_STATUS_TONE`
 * accordingly. The register shows `customerId` raw, same "no
 * client-side id-to-name resolution" precedent the AP register and
 * `ProjectRisksPage` both already set.
 *
 * `GET /ap/invoices` returns each invoice's `lines` (confirmed directly
 * against `AccountsPayableController.listInvoices` → `AccountsPayableService.listInvoices`,
 * which `include: { lines: true }`) but `VendorInvoice` itself has no
 * stored total (confirmed against its own schema comment — only
 * `amountPaid` is stored, maintained when a payment voucher posts) — so
 * this page computes each row's total client-side from `quantity ×
 * unitCost` per line, the same "backend supplies the parts, this page
 * sums them" reasoning `postInvoice`'s own journal-line loop uses
 * server-side for the identical calculation.
 *
 * The register table shows `vendorId` raw, not a resolved vendor name —
 * same "id from a registry with nothing joined into this particular
 * response" shape `ProjectRisksPage`'s own table already uses for
 * `projectId`. `vendorOptions` (`GET /dimensions/vendors`, confirmed
 * global/unfiltered) is fetched purely for `CreateAPInvoiceForm`'s own
 * `Select`, not to resolve names in the table — resolving every row's
 * id to a name via a client-side map would be new UI precedent this
 * checkpoint doesn't need to set.
 *
 * AP.4 adds a "Payment batches" section between the AP and AR
 * registers (`CreatePaymentBatchForm`, `PaymentBatchActions`) — the
 * feature FC-1.4's own investigation surfaced in place of a declined
 * generic "bulk actions" primitive. See both new components' own doc
 * comments for the full rationale; the short version: `AccountsPayableController`
 * has no read endpoint at all for this resource (no list, no
 * single-batch GET), so this section is necessarily ID-entry driven
 * rather than a register — the same constraint and the same established
 * fix `SessionSelector.tsx`/`EntitySelector.tsx` already use elsewhere
 * in this app.
 *
 * AP.5 adds `CreatePaymentVoucherForm` to the same section — see its
 * own doc comment for scoping. `invoiceOptions` (from `data.invoices`,
 * already fetched) is new, feeding that form's own per-allocation
 * `Select`.
 *
 * AP.6 adds `PaymentVoucherActions` immediately after — see its own
 * doc comment for why it's lookup-driven rather than blind-ID-entry
 * like `PaymentBatchActions` (a real `GET` exists for this resource).
 */
async function loadApAr(entityId: string) {
  const [outstanding, forecast, invoices, vendors, accounts, arInvoices, customers] = await Promise.all([
    fetchApi<OutstandingPayablesReceivables>(`/dashboard/outstanding-payables-receivables?entityId=${entityId}`),
    fetchApi<CashForecast>(`/dashboard/cash-forecast?entityId=${entityId}`),
    fetchApi<APInvoice[]>(`/ap/invoices?entityId=${entityId}`),
    fetchApi<Vendor[]>('/dimensions/vendors'),
    fetchApi<Account[]>(`/accounts/entity/${entityId}/active`),
    fetchApi<ARInvoice[]>(`/ar/invoices?entityId=${entityId}`),
    fetchApi<Customer[]>('/dimensions/customers'),
  ]);
  return {
    outstanding,
    forecast,
    invoices,
    vendorOptions: vendors.map<SelectOption>((v) => ({ value: v.id, label: `${v.code} — ${v.name}` })),
    accountOptions: accounts.map<SelectOption>((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    arInvoices,
    customerOptions: customers.map<SelectOption>((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    invoiceOptions: invoices.map<SelectOption>((i) => ({ value: i.id, label: i.invoiceNumber })),
  };
}

export default async function ApArPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="AP / AR" subtitle="Enter an entity ID to view its cash position." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadApAr>> | null = null;
  let error: string | null = null;
  try {
    data = await loadApAr(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load AP/AR data.';
  }

  return (
    <PageContainer>
      <PageHeader title="AP / AR" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard
              label="Payables outstanding"
              value={formatCurrency(data.outstanding.payables.total)}
              tone="warning"
              caption={`${data.outstanding.payables.invoiceCount} open invoice${data.outstanding.payables.invoiceCount === 1 ? '' : 's'}`}
            />
            <KpiCard
              label="Receivables outstanding"
              value={formatCurrency(data.outstanding.receivables.total)}
              tone="positive"
              caption={`${data.outstanding.receivables.invoiceCount} open invoice${data.outstanding.receivables.invoiceCount === 1 ? '' : 's'}`}
            />
            <KpiCard
              label="Net position"
              value={formatCurrency(data.outstanding.netPosition)}
              tone={data.outstanding.netPosition < 0 ? 'negative' : 'positive'}
              caption="receivables − payables"
            />
          </section>

          <section>
            <PageHeader title="Cash forecast" subtitle="Outflow (AP due) vs inflow (AR due) by horizon" />
            <CashForecastTable rows={data.forecast.horizons} />
          </section>

          <section>
            <PageHeader title="AP invoice register" />
            <CreateAPInvoiceForm entityId={entityId} vendorOptions={data.vendorOptions} accountOptions={data.accountOptions} />
            <APInvoiceTable rows={data.invoices} accountOptions={data.accountOptions} />
          </section>

          <section>
            <PageHeader
              title="Payment batches"
              subtitle="Group approved AP vouchers for one shared approval + posting step"
            />
            <CreatePaymentBatchForm entityId={entityId} />
            <ImportPaymentBatchForm entityId={entityId} />
            <PaymentBatchActions accountOptions={data.accountOptions} />
            <CreatePaymentVoucherForm entityId={entityId} vendorOptions={data.vendorOptions} invoiceOptions={data.invoiceOptions} />
            <PaymentVoucherActions accountOptions={data.accountOptions} />
          </section>

          <section>
            <PageHeader title="AR invoice register" />
            <CreateARInvoiceForm entityId={entityId} customerOptions={data.customerOptions} accountOptions={data.accountOptions} />
            <ARInvoiceTable rows={data.arInvoices} accountOptions={data.accountOptions} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
