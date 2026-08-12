import { PageContainer, PageHeader } from '@7f/ui';
import { LoginForm } from './LoginForm';

/**
 * Frontend Completion, Checkpoint AI — see `LoginForm.tsx`/`actions.ts`
 * for the full scoping rationale. Same `PageContainer`/`PageHeader`
 * shell every other page uses; unlike every other page, this one takes
 * no `searchParams.entityId` and renders no `EntitySelector` — login
 * happens before any entity context exists, and doesn't need the
 * `dynamic = 'force-dynamic'` export those pages use either (this page
 * fetches nothing itself; `LoginForm`'s own submit is what talks to the
 * API).
 *
 * Not yet linked from `AppShell`'s `NAV_LINKS` — this checkpoint adds
 * the route and the form, not the surrounding "am I logged in" chrome
 * (a visible session indicator / log-out control) that would make a nav
 * link meaningful. Linking it in now, before that exists, would read as
 * a finished auth affordance rather than the first slice of one.
 */
export default function LoginPage() {
  return (
    <PageContainer>
      <PageHeader title="Log in" subtitle="7F LedgerOS" />
      <LoginForm />
    </PageContainer>
  );
}
