'use client';

import * as React from 'react';
import { tokens } from '@7f/ui';

/**
 * Completion Roadmap, FC-2.1 — Power BI Embedding, the one FC-2 item
 * `power-bi/page.tsx` explicitly hadn't done yet: `RefreshAndEmbedForm`
 * (FE-9.1) fetched `embedUrl`/`accessToken` and printed them as plain
 * text — useful for verifying the backend mechanism, but not an actual
 * embedded report. This component is that missing piece.
 *
 * Uses `powerbi-client`, Microsoft's own official embed SDK — added as
 * a new dependency here, the first third-party runtime dependency
 * anywhere in `apps/web` (confirmed directly: both `package.json` and
 * `Toast.tsx`'s own doc comment, which chose NOT to add a toast
 * library because "the requirement... doesn't need one," establish
 * this app's default is to avoid them). This is the deliberate
 * exception, not a quiet departure from that default: a Power BI
 * `reportEmbed` URL's security token is validated by Power BI's own
 * client-side JS, not by a plain `<iframe src>` — there is no
 * dependency-free way to embed an interactive, access-controlled Power
 * BI report, unlike Toast's own "just a positioned div and a
 * `setTimeout`" case.
 *
 * A `useEffect` + ref (not a top-level render helper) because
 * `service.embed()` is imperative — it takes a live DOM container and
 * manages the report's own iframe internally; React never owns that
 * child DOM. Cleanup (`powerbiService.reset(container)`) on unmount and
 * on `embedUrl`/`accessToken` change (a re-fetched embed config,
 * e.g. after a token refresh) prevents stacking a second report inside
 * the same container.
 *
 * `tokenType: models.TokenType.Embed` — this app's own
 * `PowerBiProvider.getEmbedConfig()` (see `power-bi.provider.ts`)
 * issues a plain embed token, not an AAD user token, so `Embed` is the
 * correct type here, not `Aad`.
 */
export function PowerBiEmbed({ embedUrl, accessToken, reportId }: { embedUrl: string; accessToken: string; reportId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let powerbiService: import('powerbi-client').service.Service | undefined;
    const container = containerRef.current;

    async function embed() {
      if (!container) return;
      try {
        const pbi = await import('powerbi-client');
        powerbiService = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory,
        );
        if (cancelled) return;

        powerbiService.embed(container, {
          type: 'report',
          id: reportId,
          embedUrl,
          accessToken,
          tokenType: pbi.models.TokenType.Embed,
          settings: {
            panes: { filters: { visible: false }, pageNavigation: { visible: true } },
          },
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to embed report.');
      }
    }

    embed();

    return () => {
      cancelled = true;
      if (container && powerbiService) {
        powerbiService.reset(container);
      }
    };
  }, [embedUrl, accessToken, reportId]);

  if (error) {
    return <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '600px',
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        background: tokens.color.surface,
      }}
    />
  );
}
