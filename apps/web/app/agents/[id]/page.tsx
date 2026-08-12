import Link from 'next/link';
import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EditAgentForm } from './EditAgentForm';
import type { AgentFormValues } from './EditAgentForm';
import { AgentLifecycleActions } from './AgentLifecycleActions';
import { AgentCommissionStatement } from './AgentCommissionStatement';

export const dynamic = 'force-dynamic';

interface AgentDetail {
  id: string;
  code: string;
  entityId: string;
  agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  displayName: string;
  contactPersonName: string | null;
  email: string;
  phone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  licenseNumber: string | null;
  licenseIssuingBody: string | null;
  licenseExpiryDate: string | null;
  registrationNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSwiftCode: string | null;
  taxIdentificationNumber: string | null;
  withholdingTaxExempt: boolean;
  agreementReference: string | null;
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  suspendReason: string | null;
  terminateReason: string | null;
  notes: string | null;
}

const STATUS_TONE: Record<AgentDetail['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  PENDING_APPROVAL: 'warning',
  ACTIVE: 'positive',
  SUSPENDED: 'negative',
  TERMINATED: 'neutral',
};

/**
 * Agent Management, RE-AGENT.1 (frontend) — `/agents/[id]`, the profile
 * page the register's own Code column links to. `GET /agents/:id` is a
 * genuinely single-item endpoint (confirmed directly) — the
 * `/entities/[id]` shape, not the fetch-the-list-and-find-by-id
 * workaround `/consolidation/[id]` needed for a resource with no such
 * route.
 *
 * "View assignment history →" links to `/agent-assignments` scoped to
 * this agent's own `entityId`/`id` via query params
 * (`?entityId=...&agentId=...`) — that page (RE-AGENT.2's own
 * checkpoint) already reads exactly those two params to run its
 * by-agent lookup on load, confirmed directly by re-reading its own
 * `searchParams` handling before wiring this link, rather than assuming
 * the param names matched.
 */
export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  let agent: AgentDetail | null = null;
  let error: string | null = null;
  try {
    agent = await fetchApi<AgentDetail>(`/agents/${params.id}`);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load agent.';
  }

  if (error || !agent) {
    return (
      <PageContainer>
        <PageHeader title="Agent profile" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents', href: '/agents' }]} />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Agent not found.'}</div>
      </PageContainer>
    );
  }

  const initialValues: AgentFormValues = {
    agentType: agent.agentType,
    displayName: agent.displayName,
    contactPersonName: agent.contactPersonName ?? '',
    email: agent.email,
    phone: agent.phone,
    addressLine1: agent.addressLine1 ?? '',
    addressLine2: agent.addressLine2 ?? '',
    city: agent.city ?? '',
    state: agent.state ?? '',
    country: agent.country ?? '',
    licenseNumber: agent.licenseNumber ?? '',
    licenseIssuingBody: agent.licenseIssuingBody ?? '',
    licenseExpiryDate: agent.licenseExpiryDate ? agent.licenseExpiryDate.slice(0, 10) : '',
    registrationNumber: agent.registrationNumber ?? '',
    bankName: agent.bankName ?? '',
    bankAccountName: agent.bankAccountName ?? '',
    bankAccountNumber: agent.bankAccountNumber ?? '',
    bankSwiftCode: agent.bankSwiftCode ?? '',
    taxIdentificationNumber: agent.taxIdentificationNumber ?? '',
    withholdingTaxExempt: agent.withholdingTaxExempt,
    agreementReference: agent.agreementReference ?? '',
    agreementStartDate: agent.agreementStartDate ? agent.agreementStartDate.slice(0, 10) : '',
    agreementEndDate: agent.agreementEndDate ? agent.agreementEndDate.slice(0, 10) : '',
    notes: agent.notes ?? '',
  };

  return (
    <PageContainer>
      <PageHeader
        title={`${agent.code} — ${agent.displayName}`}
        subtitle={`${agent.agentType.charAt(0)}${agent.agentType.slice(1).toLowerCase()} agent`}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents', href: '/agents' }, { label: agent.code }]}
      />

      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6), flexWrap: 'wrap' }}>
        <Badge tone={STATUS_TONE[agent.status]}>{agent.status.replace('_', ' ')}</Badge>
        {agent.status === 'SUSPENDED' && agent.suspendReason && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Reason: {agent.suspendReason}</span>
        )}
        {agent.status === 'TERMINATED' && agent.terminateReason && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Reason: {agent.terminateReason}</span>
        )}
        <Link
          href={`/agent-assignments?entityId=${encodeURIComponent(agent.entityId)}&agentId=${encodeURIComponent(agent.id)}`}
          style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px', marginLeft: 'auto' }}
        >
          View assignment history →
        </Link>
      </div>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Lifecycle</h2>
        <AgentLifecycleActions agentId={agent.id} status={agent.status} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Commission statement</h2>
        <AgentCommissionStatement agentId={agent.id} />
      </section>

      <section>
        <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Profile</h2>
        <EditAgentForm agentId={agent.id} initialValues={initialValues} />
      </section>
    </PageContainer>
  );
}
