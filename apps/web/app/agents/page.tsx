import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateAgentForm } from './CreateAgentForm';

export const dynamic = 'force-dynamic';

interface Agent {
  id: string;
  code: string;
  agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  displayName: string;
  email: string;
  phone: string;
  licenseExpiryDate: string | null;
}

const STATUS_TONE: Record<Agent['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  PENDING_APPROVAL: 'warning',
  ACTIVE: 'positive',
  SUSPENDED: 'negative',
  TERMINATED: 'neutral',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'BROKER', label: 'Broker' },
];

/**
 * Agent Management, RE-AGENT.1 (frontend) — Agent Master directory.
 * Entity-scoped via `EntitySelector`, the same pattern
 * `/agent-assignments` and `/land-bank` already established — `GET
 * /agents?entityId=X` with no `status`/`agentType`/`search` query
 * params sent server-side; those three are handled entirely by
 * `DataTable`'s own `filters`/`search` props client-side instead (the
 * same choice `/land-bank`'s own Status filter already made), since a
 * directory search shouldn't trigger a full page navigation per
 * keystroke the way this app's opaque-ID lookups (`PeriodSelector`,
 * `AgentSelector` in `/agent-assignments`) do.
 */
async function loadAgents(entityId: string) {
  return fetchApi<Agent[]>(`/agents?entityId=${encodeURIComponent(entityId)}`);
}

export default async function AgentsPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let agents: Agent[] | null = null;
  let error: string | null = null;
  if (entityId) {
    try {
      agents = await loadAgents(entityId);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load agents.';
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        subtitle="External sales agents, brokers, and companies engaged to sell or lease on this entity's behalf — distinct from internal ERP users."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents' }]}
      />

      <EntitySelector initialValue={entityId} />

      {!entityId && (
        <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Select an entity above to view or register agents.
        </div>
      )}

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      {agents && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total agents" value={String(agents.length)} />
            <KpiCard label="Active" value={String(agents.filter((a) => a.status === 'ACTIVE').length)} />
            <KpiCard label="Pending approval" value={String(agents.filter((a) => a.status === 'PENDING_APPROVAL').length)} />
          </section>

          <CreateAgentForm entityId={entityId!} />

          <DataTable
            columns={[
              { header: 'Code', render: (a: Agent) => <Link href={`/agents/${a.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>{a.code}</Link> },
              { header: 'Name', render: (a: Agent) => a.displayName },
              { header: 'Type', render: (a: Agent) => a.agentType },
              { header: 'Email', render: (a: Agent) => a.email },
              { header: 'Phone', render: (a: Agent) => a.phone },
              { header: 'License expiry', render: (a: Agent) => (a.licenseExpiryDate ? new Date(a.licenseExpiryDate).toLocaleDateString() : '—') },
              { header: 'Status', render: (a: Agent) => <Badge tone={STATUS_TONE[a.status]}>{a.status.replace('_', ' ')}</Badge> },
            ]}
            rows={agents}
            keyOf={(a) => a.id}
            emptyMessage="No agents registered for this entity yet."
            search={{ placeholder: 'Search name, code, email, phone…', getText: (a) => `${a.code} ${a.displayName} ${a.email} ${a.phone}` }}
            filters={[
              { label: 'Status', options: STATUS_FILTER_OPTIONS, getValue: (a: Agent) => a.status },
              { label: 'Type', options: TYPE_FILTER_OPTIONS, getValue: (a: Agent) => a.agentType },
            ]}
          />
        </>
      )}
    </PageContainer>
  );
}
