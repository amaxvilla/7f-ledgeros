import * as React from 'react';
import { tokens } from '../tokens';
import { Nav } from './Nav';
import { LogoutButton } from './LogoutButton';
import { NotificationsMenu, NotificationItem } from './NotificationsMenu';
import { ThemeToggle } from './ThemeToggle';

export interface AppShellProps {
  children: React.ReactNode;
  /**
   * Checkpoint AK. Omit entirely (leave `undefined`) to render no auth
   * control at all — this keeps every existing caller (and every
   * existing test that renders `<AppShell>` without this prop)
   * unchanged. Pass `true`/`false` explicitly to show the "Log out"/
   * "Log in" control described on `onLogout` below.
   */
  isLoggedIn?: boolean;
  /**
   * A Server Action reference, passed down from the caller (this
   * package has no auth internals of its own to import) — same
   * "caller-supplied, not fetched/imported by the component itself"
   * split `Select`'s own doc comment already established for options.
   * Handed to `LogoutButton`, a small 'use client' component that calls
   * it directly from an `onClick` handler rather than via a
   * `<form action={onLogout}>` DOM attribute — see LogoutButton.tsx's
   * own doc comment for why (Checkpoint AL, replacing Checkpoint AK's
   * original form-action approach once the React 18-vs-19 caveat it
   * had flagged was confirmed for real). `AppShell` itself stays a
   * Server Component either way — only `LogoutButton` needs
   * `'use client'`. Only rendered when `isLoggedIn` is `true`; ignored
   * otherwise.
   */
  onLogout?: () => Promise<void>;
  /**
   * FE-1.2 — User Profile (header indicator). The account's email,
   * decoded from the access token cookie by the caller (`lib/jwt.ts`'s
   * `decodeAccessTokenEmail`) — see that module's own doc comment for
   * why this can only ever be an email, not a full profile, without new
   * backend work this checkpoint deliberately doesn't do. Rendered as
   * plain text next to the logout control; omitted entirely when
   * `undefined` (not logged in, or decoding failed), same optional-prop
   * convention `isLoggedIn`/`onLogout` already established.
   */
  userEmail?: string;
  /**
   * FE-1.2 — Notifications (header indicator). Initial data the caller
   * already fetched server-side (`GET /dashboard/my-notifications`,
   * Release F) — see `NotificationsMenu`'s own doc comment for why this
   * component never fetches on its own. Omitted entirely when
   * `undefined` (not logged in, or the fetch failed) — same "never
   * break the whole page over a chrome-level widget" posture every
   * other optional prop here already has.
   */
  notifications?: { unreadCount: number; recent: NotificationItem[] };
  /** Server Action references for `NotificationsMenu` — see that component's own doc comment for the contract. Both required together with `notifications` (see the render guard below); a caller passing one without the other is a caller bug this component doesn't try to paper over. */
  onMarkNotificationRead?: (id: string) => Promise<{ ok: boolean; error?: string } | void>;
  onMarkAllNotificationsRead?: () => Promise<{ ok: boolean; error?: string } | void>;
}

/**
 * Frontend Completion, Checkpoint A — the app's persistent chrome.
 *
 * Before this checkpoint, layout.tsx rendered nothing but
 * `<body>{children}</body>` — every page (today, just the dashboard)
 * supplied its own full-bleed content with no shared top bar, so a
 * loading/error/not-found special file (see app/loading.tsx,
 * app/error.tsx, app/not-found.tsx, added alongside this component in
 * the same checkpoint) would have rendered as a bare, unbranded page —
 * the opposite of what a special file is for, which is to look like a
 * natural continuation of the rest of the app while the real content
 * loads or fails.
 *
 * Checkpoint A deliberately shipped with NO nav links — only one real
 * page existed, so links would have been broken 404s wearing a nav
 * bar's clothing. Checkpoint B added Recruitment (two items). Checkpoint
 * C added Payments (three items) and flagged three as still comfortably
 * a flat list, "worth revisiting once a fourth page lands." Checkpoint D
 * added Security as that fourth item and named the nav-component
 * threshold as reached.
 *
 * Checkpoint E is that nav component: NAV_LINKS (the actual route data)
 * stays right here — still an AppShell/Server-Component concern, no
 * different from before — but the rendering + active-route highlighting
 * + mobile collapse is now delegated to <Nav>, a small 'use client'
 * component (see Nav.tsx's own doc comment for why it has to be one).
 * `position: 'relative'` was added to the header below specifically so
 * Nav's mobile dropdown panel (`position: absolute`) anchors correctly
 * underneath it, rather than to the nearest OTHER positioned ancestor
 * (there wasn't one before this checkpoint, so this is a genuinely new
 * requirement Nav introduced, not a pre-existing gap).
 *
 * Checkpoint K added CRM as the fifth link — see app/crm/page.tsx's own
 * doc comment for why it was picked next.
 * Checkpoint L added Fixed Assets as the sixth — see
 * app/fixed-assets/page.tsx's own doc comment.
 * Checkpoint M added Tax as the seventh — see app/tax/page.tsx's own
 * doc comment.
 * Checkpoint N added Facility Management as the eighth — see
 * app/facility-management/page.tsx's own doc comment.
 * Checkpoint O added Lease Management as the ninth — see
 * app/lease-management/page.tsx's own doc comment.
 * Checkpoint P added Tenants as the tenth — see app/tenants/page.tsx's
 * own doc comment. (This line was missing until Checkpoint AM, which
 * added it along with the matching fix to AppShell.test.tsx's nav-
 * composition assertions — see that test file's own comment on
 * Checkpoint AL's release report for how the gap was found.)
 *
 * (My Security, the eleventh link, was added to this array at some
 * point without a corresponding line here or in AppShell.test.tsx's own
 * assertions — the exact same gap shape Checkpoint AM had just fixed
 * for Tenants, recurring. Found and fixed together with the twelfth
 * link below, rather than left for a third occurrence.)
 *
 * Checkpoint AR added API Keys as the twelfth — see
 * app/api-gateway/page.tsx's own doc comment. Fixed AppShell.test.tsx's
 * assertions in the same change to include both this and the
 * previously-unlisted My Security, rather than compounding the existing
 * gap with a new one.
 *
 * PMO.1 added Bill of Quantities as the twenty-first — see
 * app/boq/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * (Mortgage, the thirteenth link, was added to this array at some point
 * without a corresponding line here or in AppShell.test.tsx's own
 * assertions — the same recurring gap shape Checkpoint AM fixed once
 * for Tenants and the entry above fixed once for My Security. Found and
 * fixed together with Treasury, the fourteenth link below, rather than
 * left for a fourth occurrence.)
 *
 * Treasury added as the fourteenth — see app/treasury/page.tsx's own
 * doc comment. Fixed AppShell.test.tsx's assertions in the same change
 * to include both this and the previously-unlisted Mortgage.
 *
 * Bank Integration added as the fifteenth — see
 * app/bank-integration/page.tsx's own doc comment. AppShell.test.tsx's
 * assertions and this log were both updated in the same change this
 * time, rather than after the fact — no gap to fix alongside it.
 *
 * Checkpoint AK added the auth control on the right side of the header
 * (`isLoggedIn`/`onLogout` props, see their own doc comments) — the
 * first thing in this header that isn't a `NAV_LINKS` entry. Checkpoint
 * AL swapped its logout control's implementation from a form-action to
 * `LogoutButton` (see onLogout's own doc comment) without changing this
 * component's own props or rendering conditions.
 *
 * Project Risks added as the sixteenth — see
 * app/project-risks/page.tsx's own doc comment. AppShell.test.tsx's
 * assertions and this log were both updated in the same change this
 * time, matching Bank Integration's own precedent for not leaving a gap.
 *
 * Project Issues added as the seventeenth — see
 * app/project-issues/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Budgeting added as the eighteenth — see app/budgeting/page.tsx's own
 * doc comment. Same discipline continued: AppShell.test.tsx's
 * assertions and this log both updated in the same change.
 *
 * AP / AR added as the nineteenth — see app/ap-ar/page.tsx's own doc
 * comment. Same discipline continued: AppShell.test.tsx's assertions
 * and this log both updated in the same change.
 *
 * Signatures added as the twentieth — see app/signatures/page.tsx's own
 * doc comment. Bill of Quantities added as the twenty-first (PMO.1) and
 * Work Packages as the twenty-second (PMO.2) — see app/boq/page.tsx's
 * and app/work-packages/page.tsx's own doc comments. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * General Ledger added as the twenty-third (FE-3.1), opening Stage
 * FE-3 — see app/general-ledger/page.tsx's own doc comment. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Dimensions added as the twenty-fourth (FE-3.2) — see
 * app/dimensions/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * FE-1.1 added a `<footer>` below `{children}` — one of the confirmed
 * gaps from an inventory pass against the new master prompt's own FE-1
 * (Application Shell) item list ("Breadcrumbs" was the other; see
 * `PageHeader`'s own doc comment in Badge.tsx for that one instead,
 * since a global nav bar has no per-route knowledge to render those
 * itself). Static content only (no data fetch, no backend dependency) —
 * a copyright line and the same "7F LedgerOS" brand mark the header
 * already uses, kept deliberately minimal rather than guessing at
 * additional footer links/content this prompt's own item list doesn't
 * actually ask for.
 *
 * FE-1.2 added two more confirmed FE-1 gaps together: User Profile (a
 * plain-text email next to the logout control, decoded from the access
 * token — see `lib/jwt.ts`'s own doc comment for why this can't yet be
 * a full profile) and Notifications (`NotificationsMenu`, backed by the
 * existing Release F Notifications API with zero new backend work —
 * see that component's own doc comment). Both picked for the same
 * reason FE-1.1 picked Footer/Breadcrumbs over Sidebar: no real layout
 * restructuring, and (for Notifications specifically) a backend that
 * already fully supports it, unlike Search, which would still need an
 * index/query surface that doesn't exist yet, or Settings, which has no
 * obvious backend surface to point at yet either.
 *
 * FE-1.3 fixes a regression FE-1.2 shipped: `userEmail`, `notifications`,
 * `onMarkNotificationRead`, and `onMarkAllNotificationsRead` were all
 * added to `AppShellProps` and used in this component's render body, but
 * never actually destructured off the function's own parameter — so
 * every caller (including `layout.tsx`, which was passing all four
 * correctly the whole time) silently got neither User Profile nor
 * Notifications, and `AppShell.test.tsx`'s own FE-1.2 assertions for
 * both were failing. Same "found while auditing this checkpoint's own
 * stage, fixed in the same change rather than left for a second
 * occurrence" discipline the NAV_LINKS gaps above already established
 * for Tenants/My Security and Mortgage/Treasury.
 *
 * Deliberately NOT bundling Theme into this checkpoint even though it's
 * the next unclaimed FE-1 item: `tokens` (see tokens.ts's own doc
 * comment) is a single static palette by design — "grounded in the
 * product itself... not a generic admin-template palette" — consumed as
 * plain `tokens.color.X` property access in every component this
 * package has, not CSS variables. A real toggle needs that whole access
 * pattern converted to a ThemeProvider/CSS-variable scheme first, which
 * is a restructuring checkpoint of its own, not a "2-3 closely related
 * features" addition alongside a one-line prop-destructuring fix.
 *
 * HR added as the twenty-fifth link (FE-2.1, opening Stage FE-2) — see
 * app/hr/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * Real Estate added as the twenty-sixth link (FE-2.2) — see
 * app/real-estate/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Executive added as the twenty-seventh link (FE-2.3) — see
 * app/executive/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * HSE added as the twenty-eighth link (FE-2.3's own recommended next
 * checkpoint) — see app/hse/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * PMO added as the twenty-ninth link (FE-2.4's own recommended next
 * checkpoint — a project-selector plus the PMO Dashboard it unblocks,
 * closing out Stage FE-2 in full) — see app/pmo/page.tsx's and
 * app/ProjectSelector.tsx's own doc comments. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * ADDENDUM — Sidebar conversion (FE-1.5's own recommended next
 * checkpoint, now attempted with real `tsc`/Vitest tooling confirmed
 * working). `Nav` now renders a persistent left `<aside>` instead of a
 * horizontal top-bar row — see `Nav.tsx`'s own doc comment for the full
 * before/after. This component's own render body moved `<Nav
 * links={NAV_LINKS} />` out of `<header>` and into a new `flex: 1,
 * display: 'flex'` row between the header and footer, alongside the
 * page's own `children` — `NAV_LINKS` itself is UNCHANGED (still the
 * same 29 entries, same order); only where and how they're rendered
 * changed. `<header>`'s own `position: relative` was removed — it
 * existed solely so `Nav`'s old absolutely-positioned mobile panel
 * could anchor to it, and the panel is now a viewport-`fixed` overlay
 * that no longer needs a positioned ancestor (see `Nav.tsx`'s own doc
 * comment, point 2).
 *
 * Procurement added as the thirtieth link (FE-3.3, continuing Stage
 * FE-3 with Purchase Requisitions and Purchase Orders) — see
 * app/procurement/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Inventory added as the thirty-first link (FE-3.4, FE-3.3's own
 * recommended next checkpoint — Warehouses, Stock Items, and a stock
 * balance lookup) — see app/inventory/page.tsx's own doc comment. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Revenue Recognition added as the thirty-second link (FE-3.5, FE-3.4's
 * own recommended next checkpoint — two standalone command forms, no
 * list endpoints on this module at all) — see
 * app/revenue-recognition/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Bank Reconciliation added as the thirty-third link (FE-3.6, FE-3.5's
 * own recommended next checkpoint — the id-entry pattern this stage's
 * write-ups kept deferring, since Bank Reconciliation has no
 * list-by-entity endpoint at all). This closes out Stage FE-3 (Finance
 * Modules) entirely. See app/bank-reconciliation/page.tsx's own doc
 * comment. Same discipline continued: AppShell.test.tsx's assertions
 * and this log both updated in the same change.
 *
 * Land Bank added as the thirty-fourth link (FE-4.1, opening Stage
 * FE-4 — Real Estate — with Land Parcels and Land Acquisitions) — see
 * app/land-bank/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * Handover added as the thirty-fifth link (FE-4.2) — the one FE-4
 * domain with a fully-built backend (`HandoverController`/
 * `HandoverService`: schedule/inspect/cancel/complete plus a snags
 * sub-workflow) and no frontend page at all yet, confirmed directly
 * rather than assumed from the module name. See
 * app/handover/page.tsx's own doc comment. Same discipline continued:
 * AppShell.test.tsx's assertions and this log both updated in the same
 * change.
 *
 * Property Sales added as the thirty-sixth link (FE-4.7's own
 * recommended next checkpoint — a fresh "which FE-4 domains already
 * exist" pass found Mortgage/Handover/Lease Management/Facility
 * Management all already built; only Sales, the unit reservation →
 * allocation pipeline, had nothing) — see
 * app/real-estate/sales/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Project Tasks added as the thirty-seventh link (FE-5.1, opening
 * Stage FE-5 — PMO — after confirming `/pmo` is a read-only dashboard
 * and `tasks.controller.ts` is a Microsoft/Google Tasks sync
 * integration, neither of which is the actual PMO Tasks roadmap item;
 * the real `ProjectTask` CRUD on `SchedulingController` had no
 * frontend page at all) — see app/project-tasks/page.tsx's own doc
 * comment. Same discipline continued: AppShell.test.tsx's assertions
 * and this log both updated in the same change.
 *
 * Integrations added as the thirty-eighth link (FE-7.1, opening Stage
 * FE-7 — after confirming Roles/Permissions, FE-6's own remaining
 * items, have no backend surface anywhere in this API to build a page
 * on) — one connector registry (`IntegrationProvider`/
 * `IntegrationsController`) spanning Microsoft Graph, Google Workspace,
 * SMS, WhatsApp, Power BI, and more, confirmed directly against
 * `IntegrationCategory`'s own enum rather than assumed from the module
 * name. See app/integrations/page.tsx's own doc comment. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Roles added as the thirty-ninth link (FE-6, picked back up directly
 * by request) — FE-7.1's own "no backend surface" finding immediately
 * above was true AT THE TIME but is resolved as of this checkpoint:
 * `Role`/`Permission`/`RolePermission`/`UserRole` were always real,
 * live-authorization Prisma models (confirmed against `JwtStrategy
 * .validate()`, which queries this exact chain on every request), just
 * with no REST surface — `RolesController` (this checkpoint's own new
 * module) is that surface now. See app/roles/page.tsx's own doc
 * comment. Same discipline continued: AppShell.test.tsx's assertions
 * and this log both updated in the same change.
 *
 * Users added as the fortieth link (Roles.1's own recommended next
 * checkpoint) — same "no REST surface, despite live/load-bearing data"
 * shape Roles just resolved: `GET /users` is a NEW endpoint
 * (`UsersController`), reusing `SECURITY_ACCESS_VIEW` rather than a new
 * permission code — see app/users/page.tsx's and
 * apps/api/src/users/users.controller.ts's own doc comments for why.
 * Same discipline continued: AppShell.test.tsx's assertions and this
 * log both updated in the same change.
 *
 * Feature Flags added as the forty-first link (FE-8.1, opening Stage
 * FE-8 — Administration — after confirming FE-6/Security is now fully
 * covered) — see app/feature-flags/page.tsx's own doc comment. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Entities added as the forty-second link (FE-8.2, the roadmap's own
 * first-listed FE-8 item, picked over `flagOverdueCorrectiveActions`
 * after confirming the latter has no natural backend home under
 * `queue/`) — see app/entities/page.tsx's own doc comment. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Admin Tools added as the forty-third link (FE-8.4,
 * `flagOverdueCorrectiveActions` finally getting a standalone home
 * after FE-8.1 and FE-8.2 each independently confirmed it has none
 * under any existing module) — see app/admin-tools/page.tsx's own doc
 * comment. Same discipline continued.
 *
 * Job Queue added as the forty-fourth link (FE-8.5) — see
 * app/queue/page.tsx's own doc comment (picked from the same 5-item
 * existence-check sweep FIX.7's own report recommended: Workflow,
 * Notifications, Queue, Monitoring, Storage). Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Workflow added as the forty-fifth link (FE-8.6) — see
 * app/workflow/page.tsx's own doc comment (the second of the two
 * genuinely-real remaining items from that same sweep — Monitoring/
 * Storage were confirmed NOT real page candidates by FE-8.5's own
 * report; Notifications remains the one item still open). Same
 * discipline continued.
 *
 * Notifications added as the forty-sixth link (FE-8.8) — see
 * app/notifications/page.tsx's own doc comment. Corrects a claim
 * repeated by both FE-8.5's original sweep and FE-8.6/FE-8.7's own
 * "Notifications remains the one item still open" restatements of it:
 * self-service notifications (header widget, mark-read) were already
 * built by FE-1.2, well before FE-8.5 ever ran — that sweep's own
 * "not yet built" finding was checking for a full register PAGE
 * specifically and stated it imprecisely as the whole feature being
 * absent. This link is for that page, not a rebuild of FE-1.2's own
 * header chrome. Same discipline continued: AppShell.test.tsx's
 * assertions and this log both updated in the same change.
 *
 * Power BI added as the forty-seventh link (FE-9.1, opening Stage FE-9
 * — Reports — after confirming Monitoring/Storage/System Configuration,
 * FE-8's own remaining items, still aren't real page candidates on a
 * fresh check: `/metrics` is Prometheus exposition text meant for a
 * scrape target, not JSON for a page, and `StorageController` only
 * serves a file by key, with no list/browse endpoint). `PowerBiController`
 * is fully wired (confirmed directly, despite a stale doc comment on
 * its own provider interface claiming otherwise) with zero frontend —
 * see app/power-bi/page.tsx's own doc comment. Same discipline
 * continued: AppShell.test.tsx's assertions and this log both updated
 * in the same change.
 *
 * Financial Statements added as the forty-eighth link (FE-9.2) — the
 * first genuinely-uncovered slice of `ReportingController`'s 31
 * endpoints, confirmed directly: Real Estate/PMO/CRM's own reporting
 * sub-methods are already consumed indirectly through
 * `dashboard/*-analytics` aggregates, re-checked against
 * `real-estate/page.tsx`/`pmo/page.tsx`'s own `fetchApi` calls rather
 * than assumed from a grep miss. Covers the three primary IFRS
 * statements (Profit or Loss, Financial Position, Cash Flows) — see
 * app/financial-statements/page.tsx's own doc comment for the six
 * further statement/report endpoints deliberately deferred to their
 * own later checkpoints. Same discipline continued: AppShell.test.tsx's
 * assertions and this log both updated in the same change.
 *
 * Reports added as the forty-ninth link (FE-9.4) — a new `/reports` hub
 * for the large set of `ReportingController` endpoints confirmed
 * genuinely unconsumed anywhere in this app as of FE-9.3's own report,
 * starting with Vendor Aging + Customer Aging. See
 * app/reports/page.tsx's own doc comment for the full reasoning. Same
 * discipline continued: AppShell.test.tsx's assertions and this log
 * both updated in the same change.
 *
 * Agent Assignments added as the fiftieth link (RE-AGENT.2) —
 * `AgentAssignmentController` was fully implemented backend-side with
 * no frontend consumer anywhere in this app; confirmed directly by
 * grepping every `app/**\/*.tsx` for `/agent-assignment` before adding
 * this. See `app/agent-assignments/page.tsx`'s own doc comment for the
 * full reasoning. Same discipline continued: AppShell.test.tsx's
 * assertions and this log both updated in the same change.
 *
 * Agents added as the fifty-first link (RE-AGENT.1, frontend) —
 * `AgentController` (the Agent master itself) was ALSO already fully
 * implemented backend-side with no frontend consumer, same as
 * `AgentAssignmentController` above; the two links sit adjacent for
 * that reason (RE-AGENT.2's own agent-assignment lookups depend on
 * this page's own `GET /agents` for their option sets, confirmed
 * directly by re-reading `/agent-assignments/page.tsx`), inserted
 * BEFORE it in `NAV_LINKS` (master data before the workflow built on
 * it) even though this checkpoint's own frontend was built second.
 *
 * FE-1.6 — Theme (light/dark toggle), picked back up after every prior
 * FE-1/FE-2 checkpoint deliberately deferred it (see the ADDENDUM
 * above for the original reasoning). Not a `NAV_LINKS` entry — this is
 * header chrome, the same category as `NotificationsMenu`/
 * `LogoutButton` — see `ThemeToggle.tsx`'s own doc comment and
 * `tokens.ts`'s own doc comment for the CSS-custom-property conversion
 * this checkpoint required first. Rendered in both the logged-in and
 * logged-out branches of this header's own auth-control block (a
 * theme preference isn't gated on being logged in), immediately before
 * the existing `userEmail`/`onLogout` and `Log in` link respectively.
 *
 * FE-1.7 — Search, the last of FE-1's four originally-named gaps
 * (Sidebar closed by FE-1.5, Theme by FE-1.6; Settings remains open —
 * see `/search/page.tsx`'s own doc comment for why Search was picked
 * over it: zero ambiguity about what a search box should do, versus
 * Settings' still-unidentified concrete backend surface). A plain
 * server-rendered `<form action="/search" method="GET">` — no
 * `'use client'`, no new Server Action, no new AppShell props — the
 * same "backend-free, no JS required" bar Theme's own toggle button
 * (which DOES need `'use client'`, unlike this) couldn't quite clear.
 * Rendered only in the logged-in branch (unlike ThemeToggle): every
 * category `GET /search` can return requires an auth cookie the way
 * every other data-bearing route in this app already does, so showing
 * the box to a logged-out visitor would only ever lead to a 401.
 *
 * FE-1.8 — Settings, the fourth and last of FE-1's originally-named
 * gaps. IS a `NAV_LINKS` entry (fifty-third) — unlike Theme/Search,
 * Settings is a full page with its own route, not header chrome. See
 * `app/settings/page.tsx`'s own doc comment for the backend surface
 * (`admin/me/preferences`) this checkpoint found already existed,
 * unconsumed, plus a real permission-gate bug fixed on it in the same
 * change.
 */
const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/recruitment', label: 'Recruitment' },
  { href: '/payments', label: 'Payments' },
  { href: '/security', label: 'Security' },
  { href: '/crm', label: 'CRM' },
  { href: '/fixed-assets', label: 'Fixed Assets' },
  { href: '/tax', label: 'Tax' },
  { href: '/facility-management', label: 'Facility Management' },
  { href: '/lease-management', label: 'Lease Management' },
  { href: '/tenants', label: 'Tenants' },
  { href: '/mortgage', label: 'Mortgage' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/bank-integration', label: 'Bank Integration' },
  { href: '/my-security', label: 'My Security' },
  { href: '/api-gateway', label: 'API Keys' },
  { href: '/project-risks', label: 'Project Risks' },
  { href: '/project-issues', label: 'Project Issues' },
  { href: '/budgeting', label: 'Budgeting' },
  { href: '/ap-ar', label: 'AP / AR' },
  { href: '/signatures', label: 'Signatures' },
  { href: '/boq', label: 'Bill of Quantities' },
  { href: '/work-packages', label: 'Work Packages' },
  { href: '/general-ledger', label: 'General Ledger' },
  { href: '/dimensions', label: 'Dimensions' },
  { href: '/hr', label: 'HR' },
  { href: '/real-estate', label: 'Real Estate' },
  { href: '/executive', label: 'Executive' },
  { href: '/hse', label: 'HSE' },
  { href: '/pmo', label: 'PMO' },
  { href: '/procurement', label: 'Procurement' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/revenue-recognition', label: 'Revenue Recognition' },
  { href: '/bank-reconciliation', label: 'Bank Reconciliation' },
  { href: '/land-bank', label: 'Land Bank' },
  { href: '/handover', label: 'Handover' },
  { href: '/real-estate/sales', label: 'Property Sales' },
  { href: '/project-tasks', label: 'Project Tasks' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/roles', label: 'Roles' },
  { href: '/users', label: 'Users' },
  { href: '/feature-flags', label: 'Feature Flags' },
  { href: '/entities', label: 'Entities' },
  { href: '/admin-tools', label: 'Admin Tools' },
  { href: '/queue', label: 'Job Queue' },
  { href: '/workflow', label: 'Workflow' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/power-bi', label: 'Power BI' },
  { href: '/financial-statements', label: 'Financial Statements' },
  { href: '/reports', label: 'Reports' },
  { href: '/agents', label: 'Agents' },
  { href: '/agent-assignments', label: 'Agent Assignments' },
  // Agent & Commission Management, RE-COMM.1 (additive)
  { href: '/commission-plans', label: 'Commission Plans' },
  // FE-1.8 — Settings, the last of FE-1's four originally-named gaps.
  // See app/settings/page.tsx's own doc comment.
  { href: '/settings', label: 'Settings' },
];

export function AppShell({
  children,
  isLoggedIn,
  onLogout,
  userEmail,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}: AppShellProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space(3),
          padding: `${tokens.space(3)} ${tokens.space(8)}`,
          borderBottom: `1px solid ${tokens.color.border}`,
          background: tokens.color.surface,
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: tokens.color.accent,
          }}
        />
        <span
          style={{
            fontFamily: tokens.font.display,
            fontSize: '15px',
            letterSpacing: '0.04em',
            color: tokens.color.textPrimary,
          }}
        >
          7F LedgerOS
        </span>
        {isLoggedIn !== undefined && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: tokens.space(3) }}>
            {isLoggedIn ? (
              <>
                <form
                  action="/search"
                  method="GET"
                  role="search"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <input
                    type="search"
                    name="q"
                    placeholder="Search..."
                    aria-label="Search"
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: '13px',
                      padding: `${tokens.space(1)} ${tokens.space(2)}`,
                      border: `1px solid ${tokens.color.border}`,
                      borderRadius: tokens.radius.sm,
                      background: tokens.color.bg,
                      color: tokens.color.textPrimary,
                      width: '160px',
                    }}
                  />
                </form>
                {notifications && onMarkNotificationRead && onMarkAllNotificationsRead && (
                  <NotificationsMenu
                    unreadCount={notifications.unreadCount}
                    recent={notifications.recent}
                    onMarkRead={onMarkNotificationRead}
                    onMarkAllRead={onMarkAllNotificationsRead}
                  />
                )}
                <ThemeToggle />
                {userEmail && (
                  <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>{userEmail}</span>
                )}
                {onLogout && <LogoutButton onLogout={onLogout} />}
              </>
            ) : (
              <>
                <ThemeToggle />
                <a
                  href="/login"
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: tokens.color.textPrimary,
                    textDecoration: 'none',
                  }}
                >
                  Log in
                </a>
              </>
            )}
          </div>
        )}
      </header>
      <div style={{ flex: 1, display: 'flex' }}>
        {isLoggedIn && <Nav links={NAV_LINKS} />}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${tokens.space(4)} ${tokens.space(8)}`,
          borderTop: `1px solid ${tokens.color.border}`,
          background: tokens.color.surface,
        }}
      >
        <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
          © {new Date().getFullYear()} 7F LedgerOS
        </span>
        <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
          Enterprise ERP
        </span>
      </footer>
    </div>
  );
}
