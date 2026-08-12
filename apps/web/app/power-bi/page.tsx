import { PageContainer, PageHeader, tokens } from '@7f/ui';
import { PublishDatasetForm } from './PublishDatasetForm';
import { PushRowsForm } from './PushRowsForm';
import { RefreshAndEmbedForm } from './RefreshAndEmbedForm';

export const dynamic = 'force-dynamic';

/**
 * Frontend Completion, FE-9.1 — Power BI Pages. See `actions.ts`'s own
 * doc comment for the full before-coding confirmation that
 * `PowerBiController` is fully wired with zero existing frontend.
 *
 * No list, no dashboard-style KPIs — deliberately, since
 * `PowerBiService` has "no Prisma persistence" (its own doc comment):
 * there is nothing local to list or aggregate. This page is three
 * direct, stateless action forms over the five endpoints
 * (publish/push/refresh+status/embed-config), the operational
 * equivalent of what `api-gateway/page.tsx` is for API keys — a way to
 * exercise and verify a mechanism, not a records browser.
 */
export default function PowerBiPage() {
  return (
    <PageContainer>
      <PageHeader title="Power BI" subtitle="Publish datasets, push rows, and manage scheduled refresh and embedded reports." />

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Publish dataset" />
        <PublishDatasetForm />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Push rows" />
        <PushRowsForm />
      </section>

      <section>
        <PageHeader title="Refresh and embedding" />
        <RefreshAndEmbedForm />
      </section>
    </PageContainer>
  );
}
