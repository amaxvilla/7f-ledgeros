/**
 * Vendor-agnostic Power BI reporting abstraction (Power BI, Checkpoint A:
 * abstraction only — the exact same abstraction-first progression
 * CalendarProvider/ContactsProvider/SignatureProvider all started with
 * in this codebase; see SignatureProvider's own doc comment for the
 * fullest write-up of why this codebase always does interface-then-
 * concrete-provider-then-caller, never the reverse).
 *
 * Named "Power BI" (not "BiProvider" or similar) because that is the
 * vendor this codebase's own roadmap names for this release — unlike
 * Calendar/Contacts/Signatures, which anticipated multiple vendors from
 * day one, nothing here currently plans a second BI vendor. Still built
 * as an interface + registry rather than a single concrete class,
 * matching the shape every other provider family in this codebase uses,
 * so a second BI vendor slots in later exactly the way AdobeSignProvider
 * slotted in beside DocuSignProvider — as a registry entry, not a
 * rewrite of every caller.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) PowerBiProviderRegistry — no concrete provider, no
 * caller, no Prisma model yet. IntegrationCategory.POWER_BI already
 * exists in the enum (added ahead of this checkpoint, no schema change
 * needed here), the same way DIGITAL_SIGNATURE was reserved before the
 * Digital Signature Providers release began.
 *
 * Covers this codebase's roadmap's three named Power BI capabilities:
 *  - Dataset Publishing: publishDataset (schema) + pushRows (data),
 *    split into two calls because Power BI's own push-dataset API
 *    treats schema definition and row insertion as separate operations
 *    (POST .../datasets to create tables, POST .../tables/{name}/rows
 *    to add data) — this interface mirrors that rather than hiding it
 *    behind one call a concrete provider would have to fake.
 *  - Scheduled Refresh: triggerRefresh + getRefreshStatus, the same
 *    trigger/poll shape SignatureProvider's own sendForSignature/
 *    getStatus pair uses for an equally asynchronous vendor operation.
 *  - Embedded Reports: getEmbedConfig, returning what Power BI's own
 *    JavaScript embed SDK needs client-side (embedUrl + a short-lived
 *    accessToken) — this codebase's caller is expected to hand that
 *    straight to the frontend, not do anything with it server-side.
 *
 * No caller has been identified yet for what in this codebase should be
 * published as a Power BI dataset (Financial Core's GL trial balance?
 * PMO's project dashboards? HRMS headcount?) — that decision belongs to
 * whichever later checkpoint adds the first real caller, the same way
 * ContactsProvider's own doc comment left "which existing record syncs
 * as a provider contact" for its own later checkpoint to decide.
 */

export type PowerBiColumnType = 'string' | 'number' | 'boolean' | 'dateTime';

export interface PowerBiColumn {
  name: string;
  dataType: PowerBiColumnType;
}

export interface PowerBiTableSchema {
  name: string;
  columns: PowerBiColumn[];
}

export interface PublishDatasetParams {
  datasetName: string;
  tables: PowerBiTableSchema[];
}

export interface PublishDatasetResult {
  /** The provider's own opaque id for this dataset — pass back into pushRows/triggerRefresh/getRefreshStatus to address it again. */
  providerDatasetId: string;
}

export interface PushRowsParams {
  providerDatasetId: string;
  tableName: string;
  rows: Record<string, unknown>[];
}

export interface TriggerRefreshParams {
  providerDatasetId: string;
}

/**
 * Deliberately narrowed to the states Power BI's own refresh-history
 * vocabulary maps onto cleanly (Unknown/InProgress/Completed/Failed/
 * Disabled) — a concrete provider's own status-mapping function is
 * expected to narrow the vendor's real vocabulary down to this union,
 * the same pattern SignatureStatus's own doc comment describes for
 * DocuSign/Adobe Sign's wider vocabularies.
 */
export type RefreshStatus = 'UNKNOWN' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface RefreshStatusResult {
  status: RefreshStatus;
}

export interface EmbedConfigParams {
  providerReportId: string;
}

export interface EmbedConfigResult {
  embedUrl: string;
  /** Short-lived — Power BI embed tokens are typically valid for about an hour; callers must not cache this past expiresAt. */
  accessToken: string;
  expiresAt: Date;
}

export interface PowerBiProvider {
  publishDataset(params: PublishDatasetParams): Promise<PublishDatasetResult>;
  pushRows(params: PushRowsParams): Promise<void>;
  triggerRefresh(params: TriggerRefreshParams): Promise<void>;
  getRefreshStatus(providerDatasetId: string): Promise<RefreshStatusResult>;
  getEmbedConfig(params: EmbedConfigParams): Promise<EmbedConfigResult>;
}

/** DI token for the active Power BI provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const POWER_BI_PROVIDER = Symbol('POWER_BI_PROVIDER');
