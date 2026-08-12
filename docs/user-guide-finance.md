# User Guide — Finance

Stage FC-5 (Documentation). First of the module-family slices FC-5.4
itself recommended splitting the User Guide into, rather than attempting
every module at once. Covers General Ledger, AP/AR, and Dimensions — read
directly from their own pages and components, not written from a generic
sense of what an ERP's finance module usually looks like.

## Dimensions — start here

`/dimensions` — shared reference data used across Finance, PMO, and Real
Estate: **Projects**, **Vendors**, **Customers**. Vendors/Customers are
system-wide (not tied to one entity); Projects are entity-scoped (enter
an entity ID to manage that entity's own projects). Create these first —
Journal Entries, AP invoices, and AR invoices all reference vendor/
customer/project ids that need to already exist.

## General Ledger

`/general-ledger` — enter an entity ID to view that entity's journal
entries and trial balance.

### Chart of Accounts

Shared reference data, not entity-specific. `CreateAccountForm` fields:
code, name, account type, account category, an optional IFRS mapping,
and an optional parent account id (for a sub-account rolling up into a
parent). Set this up before posting any journal entries — every line of
every journal entry references an account here.

### Journal Entries

`CreateJournalEntryForm`: entry date, description, and a repeatable set
of lines (account, debit, credit, optional memo per line) — starts at
two lines, since a balanced entry needs at least a debit and a credit
side.

**Lifecycle** (confirmed directly against `JournalEntryStatusActions`,
not assumed): **DRAFT → SUBMITTED → APPROVED → POSTED**, with an
available **REVERSE** action once `POSTED`. Concretely:

1. Create the entry — starts as `DRAFT`.
2. **Submit for approval** — moves it to `SUBMITTED`.
3. An approver **Approves** or **Rejects** it.
4. Once `APPROVED`, **Post** it — this is what actually affects the
   trial balance.
5. A `POSTED` entry can be **Reversed** — this does not edit the
   original entry, it creates the offsetting correction (confirmed by
   the action being named `reverse`, not `edit` or `delete` — a posted
   entry is never mutated in place).

### Trial Balance

Read-only, derived from posted journal entries for the selected entity —
not something you create directly.

## AP / AR

`/ap-ar` — enter an entity ID to view its cash position (cash forecast:
outflow from AP due vs. inflow from AR due, by horizon).

### AP invoice register

Vendor invoices, created against a vendor (from Dimensions) and
optionally a purchase order/project. Has its own status lifecycle and
posting action (`PostAPInvoiceButton`) — an invoice must exist and be
posted before it can be paid.

### Payment Batches and Payment Vouchers

Two related but distinct ways to actually pay a vendor, confirmed
directly rather than assumed to be the same thing:

- **Payment Batches** group multiple already-approved AP vouchers into
  one shared approval + posting step — useful for paying several
  vendors' invoices in a single bank run. Batches have no individual
  read/detail view in this app; track a batch by the id returned when
  you create it.
- **Payment Vouchers** are the actual payment instrument against one or
  more specific vendor invoices (an "allocations" list: which invoice,
  how much of it this voucher pays). A voucher has its own real lookup
  view — enter its id to see its current status and the one action that
  status allows: **Approve** while `DRAFT`, then **Post** (selecting the
  AP control account and cash/bank GL account to post against) once
  `APPROVED`. A voucher's own preparer cannot also approve it
  (maker-checker) — if approval fails, this is very likely why.

### AR invoice register

Customer invoices, created against a customer (from Dimensions). Has its
own posting action (`PostARInvoiceButton`), mirroring AP invoices'
own shape.

## What this guide does not cover

Every other module family (Real Estate, PMO, HR, HSE, Security,
Enterprise Integrations, Administration) — each is its own real,
separate User Guide slice, not attempted in this checkpoint. See
[`administrator-guide.md`](./administrator-guide.md) for the
administration-focused surfaces (Entities, Users, Roles, Feature Flags,
Workflow) instead of duplicating that content here.
