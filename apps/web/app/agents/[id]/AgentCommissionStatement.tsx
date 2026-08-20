import { KpiCard, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { AgentCommissionTable } from '../AgentsTables';

interface AgentStatementCalculation {
  id: string;
  allocationId: string;
  netCommission: string | number;
  status: 'CALCULATED' | 'PENDING' | 'APPROVED' | 'PAYABLE' | 'PAID' | 'REJECTED' | 'REVERSED' | 'CANCELLED';
  calculatedAt: string;
}

interface AgentStatement {
  agent: { id: string; code: string; displayName: string };
  summary: { earned: number; approved: number; payable: number; paid: number; outstanding: number };
  calculations: AgentStatementCalculation[];
}

const STATUS_TONE: Record<AgentStatementCalculation['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  CALCULATED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'warning',
  PAYABLE: 'warning',
  PAID: 'positive',
  REJECTED: 'negative',
  REVERSED: 'negative',
  CANCELLED: 'neutral',
};

/**
 * Agent & Commission Management, RE-COMM.5 (frontend) — the "Agent
 * statement" report the master prompt names, surfaced directly on the
 * agent's own profile page (`/agents/[id]`) rather than as a separate
 * route, since a statement only ever makes sense scoped to one already-
 * known agent — no register/list view is needed the way `/commission-
 * calculations` needs one across every agent.
 *
 * Fetches `GET /commission-reporting/agent-statement/:agentId` directly
 * (a fresh server-side fetch, same "each section owns its own fetchApi
 * call" posture `/agents/[id]/page.tsx`'s own `AgentLifecycleActions`
 * sibling already takes) rather than threading the parent page's own
 * already-fetched `AgentDetail` through — that response has no
 * commission data on it at all.
 */
export async function AgentCommissionStatement({ agentId }: { agentId: string }) {
  let statement: AgentStatement | null = null;
  let error: string | null = null;
  try {
    statement = await fetchApi<AgentStatement>(`/commission-reporting/agent-statement/${agentId}`);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load commission statement.';
  }

  if (error) {
    return <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error}</div>;
  }
  if (!statement) return null;

  return (
    <div>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(4),
        }}
      >
        <KpiCard label="Earned" value={formatCurrency(statement.summary.earned)} />
        <KpiCard label="Approved" value={formatCurrency(statement.summary.approved)} />
        <KpiCard label="Payable" value={formatCurrency(statement.summary.payable)} />
        <KpiCard label="Paid" value={formatCurrency(statement.summary.paid)} tone="positive" />
        <KpiCard label="Outstanding" value={formatCurrency(statement.summary.outstanding)} tone={statement.summary.outstanding > 0 ? 'warning' : 'positive'} />
      </section>
      <AgentCommissionTable rows={statement.calculations} />
    </div>
  );
}
