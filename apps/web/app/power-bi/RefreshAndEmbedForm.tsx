'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import { getEmbedConfig, getRefreshStatus, triggerRefresh } from './actions';
import { PowerBiEmbed } from './PowerBiEmbed';

/**
 * Frontend Completion, FE-9.1. Two independent lookups sharing one
 * section — trigger/poll refresh (`providerDatasetId`) and embed config
 * (`providerReportId`) are unrelated provider-side IDs on
 * `PowerBiProvider`'s own interface (confirmed directly: no shared
 * field between `TriggerRefreshParams`/`RefreshStatusResult` and
 * `EmbedConfigParams`/`EmbedConfigResult`), so this deliberately renders
 * them as two side-by-side forms rather than implying one ID feeds both.
 *
 * `accessToken` is shown in full, not masked — unlike a stored
 * credential (`IntegrationProvider.encryptedCredentials`, always
 * redacted per `integrations.service.ts`'s own `redact()`), this is a
 * short-lived, already-issued embed token the caller explicitly
 * requested to see (the same "verify the mechanism works" purpose this
 * whole page serves, see `actions.ts`'s own doc comment) — hiding it
 * would make the page unable to do the one thing this section is for.
 *
 * ADDENDUM (FC-2.1) — Power BI Embedding. `embedConfig`'s raw text
 * (still shown, unchanged, as a technical reference/copy source) is now
 * followed by an actual live `PowerBiEmbed` — see that component's own
 * doc comment for why it needs `powerbi-client`, a new dependency,
 * rather than a plain `<iframe>`. `reportId` passed to it is
 * `providerReportId` as typed into the form above; `getEmbedConfig`'s
 * own response has no separate report-id field to read it back from
 * (confirmed directly — `EmbedConfigResult` is just
 * `embedUrl`/`accessToken`/`expiresAt`), so the SDK's required `id`
 * field comes from the same value the caller already provided.
 */
export function RefreshAndEmbedForm() {
  const [refreshProviderCode, setRefreshProviderCode] = React.useState('POWER_BI');
  const [providerDatasetId, setProviderDatasetId] = React.useState('');
  const [refreshPending, setRefreshPending] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const [embedProviderCode, setEmbedProviderCode] = React.useState('POWER_BI');
  const [providerReportId, setProviderReportId] = React.useState('');
  const [embedPending, setEmbedPending] = React.useState(false);
  const [embedError, setEmbedError] = React.useState<string | null>(null);
  const [embedConfig, setEmbedConfig] = React.useState<{ embedUrl: string; accessToken: string; expiresAt: string } | null>(null);

  async function handleTriggerRefresh() {
    setRefreshPending('trigger');
    setRefreshError(null);
    const result = await triggerRefresh({ providerCode: refreshProviderCode, providerDatasetId });
    setRefreshPending(null);
    if (!result.ok) setRefreshError(result.error ?? 'Failed to trigger refresh.');
  }

  async function handleCheckStatus() {
    setRefreshPending('status');
    setRefreshError(null);
    const result = await getRefreshStatus({ providerCode: refreshProviderCode, providerDatasetId });
    setRefreshPending(null);
    if (result.ok && result.data) {
      setStatus(result.data.status);
    } else {
      setRefreshError(result.error ?? 'Failed to get refresh status.');
    }
  }

  async function handleGetEmbedConfig(e: React.FormEvent) {
    e.preventDefault();
    setEmbedPending(true);
    setEmbedError(null);
    setEmbedConfig(null);

    const result = await getEmbedConfig({ providerCode: embedProviderCode, providerReportId });

    setEmbedPending(false);
    if (result.ok && result.data) {
      setEmbedConfig(result.data);
    } else {
      setEmbedError(result.error ?? 'Failed to get embed config.');
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: tokens.space(6), marginBottom: tokens.space(6) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3), padding: tokens.space(4), border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md }}>
          <strong style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>Refresh</strong>
          <TextField label="Provider code" value={refreshProviderCode} onChange={(e) => setRefreshProviderCode(e.target.value)} required />
          <TextField label="Provider dataset ID" value={providerDatasetId} onChange={(e) => setProviderDatasetId(e.target.value)} required />
          <div style={{ display: 'flex', gap: tokens.space(2) }}>
            <Button type="button" disabled={refreshPending !== null} onClick={handleTriggerRefresh}>
              {refreshPending === 'trigger' ? 'Triggering…' : 'Trigger refresh'}
            </Button>
            <Button type="button" variant="secondary" disabled={refreshPending !== null} onClick={handleCheckStatus}>
              {refreshPending === 'status' ? 'Checking…' : 'Check status'}
            </Button>
          </div>
          {status && <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>Status: <strong>{status}</strong></div>}
          {refreshError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{refreshError}</div>}
        </div>

        <form
          onSubmit={handleGetEmbedConfig}
          style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3), padding: tokens.space(4), border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md }}
        >
          <strong style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>Embed config</strong>
          <TextField label="Provider code" value={embedProviderCode} onChange={(e) => setEmbedProviderCode(e.target.value)} required />
          <TextField label="Provider report ID" value={providerReportId} onChange={(e) => setProviderReportId(e.target.value)} required />
          <Button type="submit" disabled={embedPending}>
            {embedPending ? 'Loading…' : 'Get embed config'}
          </Button>
          {embedError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{embedError}</div>}
          {embedConfig && (
            <div style={{ fontFamily: tokens.font.body, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: tokens.space(1), wordBreak: 'break-all' }}>
              <span>Embed URL: {embedConfig.embedUrl}</span>
              <span>Access token: {embedConfig.accessToken}</span>
              <span>Expires: {new Date(embedConfig.expiresAt).toLocaleString()}</span>
            </div>
          )}
        </form>
      </div>

      {embedConfig && (
        <div>
          <strong style={{ fontFamily: tokens.font.body, fontSize: '13px', display: 'block', marginBottom: tokens.space(2) }}>Embedded report</strong>
          <PowerBiEmbed embedUrl={embedConfig.embedUrl} accessToken={embedConfig.accessToken} reportId={providerReportId} />
        </div>
      )}
    </>
  );
}
