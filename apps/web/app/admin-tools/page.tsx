import { PageContainer, PageHeader } from '@7f/ui';
import { FlagOverdueForm } from './FlagOverdueForm';

/**
 * Frontend Completion, FE-8.4 — Admin Tools. `flagOverdueCorrectiveActions`
 * is the reason this route exists: FE-8.1 (Feature Flags) and FE-8.2
 * (Entities) each independently investigated where it might belong —
 * `queue/` (only `jobs.controller.ts`/`job-runs.controller.ts`, neither
 * related), the roadmap's own "System Configuration" item (nothing
 * under `apps/api/src` maps to that name at all) — and both came back
 * empty. Rather than a fourth deferral, this checkpoint commits to a
 * small standalone route for bulk/maintenance-style admin actions that
 * don't belong to any single existing module's own page. `/admin-tools`
 * (not `/system`, the other name considered) — chosen since "system"
 * elsewhere in this app's own history has been used loosely for
 * several different things, while this route's actual job (one-off
 * bulk actions an admin runs occasionally, not a settings page) is
 * better named for what it does.
 *
 * No `EntitySelector` gate — `flagOverdueCorrectiveActions` itself
 * takes no `entityId` at all (confirmed directly against
 * `HseService.flagOverdueCorrectiveActions`, which filters only on
 * `status`/`dueDate`), the same global-action shape `/feature-flags`
 * and `/security`'s own password policy section already established
 * for entity-independent admin surfaces.
 *
 * Deliberately does NOT export `dynamic = 'force-dynamic'` — every
 * other page.tsx in this app does, but every other one also fetches
 * data server-side that needs to be current on each request; this page
 * fetches nothing at all (its one action only runs on submit, client-
 * initiated), so there's nothing for forced dynamic rendering to keep
 * fresh here — a genuine, checked exception, not an oversight.
 */
export default function AdminToolsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Admin tools"
        subtitle="One-off maintenance actions that don't belong to a single module's own page."
      />
      <FlagOverdueForm />
    </PageContainer>
  );
}
