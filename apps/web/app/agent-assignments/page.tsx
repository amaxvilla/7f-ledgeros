import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import type { ProjectOption } from '../ProjectSelector';
import { AgentSelector } from './AgentSelector';
import type { AgentOption } from './AgentSelector';
import { TargetLookupForm } from './TargetLookupForm';
import { CreateAssignmentForm } from './CreateAssignmentForm';
import { EndAssignmentButton } from './EndAssignmentButton';
import { AgentAssignmentsTable } from './AgentAssignmentsTables';

export const dynamic = 'force-dynamic';

interface AgentAssignmentRow {
  id: string;
  agentId: string;
  scope: 'PROJECT' | 'UNIT' | 'SALE';
  role: 'PRIMARY' | 'CO_AGENT' | 'REFERRAL';
  projectId: string | null;
  unitId: string | null;
  allocationId: string | null;
  isActive: boolean;
  assignedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  notes: string | null;
}


/**
 * Agent Management, RE-AGENT.2 (frontend) — Agent Assignment. Verified
 * before building (see `actions.ts`'s own doc comment): the backend is
 * fully implemented, no frontend existed anywhere in this app.
 *
 * This app has no client-side-fetch filter pattern (every scope change
 * is a full navigation with new `searchParams`, confirmed by re-checking
 * every existing page before building this one — same finding
 * `ProjectSelector`'s own doc comment already made) — so this page
 * follows that convention throughout: `EntitySelector` scopes the page
 * to one entity, `AgentSelector`/`TargetLookupForm` are two independent
 * GET-form lookups layered on top of it, both carrying `entityId`
 * forward as a hidden field so switching one lookup never drops the
 * other's own query params or the entity scope itself.
 *
 * Both lookups can be active at once (their query params don't
 * collide — `agentId` vs. `scope`/`projectId`/`unitId`/`allocationId`),
 * so this page renders whichever section(s) have enough params to
 * fetch, not an either/or tab — no tab primitive exists anywhere in
 * this app to build one from (confirmed directly), and two independent
 * result sections is a smaller, more honest UI than inventing one.
 *
 * `GET /agents` is called with `entityId` and `status=ACTIVE` — a
 * PENDING_APPROVAL/SUSPENDED/TERMINATED agent can't sensibly be newly
 * assigned to anything (confirmed directly: `AgentAssignmentService`
 * itself applies no such filter, so this is a real, additive frontend
 * narrowing, not mirroring a backend rule) — kept separate from
 * `GET /dimensions/projects`, which has no analogous status concept.
 */
async function loadEntityScopedData(entityId: string) {
  const [agents, projects] = await Promise.all([
    fetchApi<AgentOption[]>(`/agents?entityId=${encodeURIComponent(entityId)}&status=ACTIVE`),
    fetchApi<ProjectOption[]>(`/dimensions/projects?entityId=${encodeURIComponent(entityId)}`),
  ]);
  return { agents, projects };
}

export default async function AgentAssignmentsPage({
  searchParams,
}: {
  searchParams: {
    entityId?: string;
    agentId?: string;
    scope?: 'PROJECT' | 'UNIT' | 'SALE';
    projectId?: string;
    unitId?: string;
    allocationId?: string;
  };
}) {
  const entityId = searchParams.entityId;

  let agents: AgentOption[] = [];
  let projects: ProjectOption[] = [];
  let loadError: string | null = null;

  if (entityId) {
    try {
      const result = await loadEntityScopedData(entityId);
      agents = result.agents;
      projects = result.projects;
    } catch (e) {
      loadError = e instanceof ApiError ? e.message : 'Failed to load agents/projects for this entity.';
    }
  }

  let agentHistory: AgentAssignmentRow[] | null = null;
  let agentHistoryError: string | null = null;
  if (entityId && searchParams.agentId) {
    try {
      agentHistory = await fetchApi<AgentAssignmentRow[]>(`/agent-assignments/by-agent/${searchParams.agentId}`);
    } catch (e) {
      agentHistoryError = e instanceof ApiError ? e.message : 'Failed to load assignment history for this agent.';
    }
  }

  const targetId =
    searchParams.scope === 'UNIT' ? searchParams.unitId : searchParams.scope === 'SALE' ? searchParams.allocationId : searchParams.projectId;

  let targetHistory: AgentAssignmentRow[] | null = null;
  let targetHistoryError: string | null = null;
  if (entityId && searchParams.scope && targetId) {
    const qs = new URLSearchParams({ scope: searchParams.scope });
    if (searchParams.scope === 'PROJECT') qs.set('projectId', targetId);
    if (searchParams.scope === 'UNIT') qs.set('unitId', targetId);
    if (searchParams.scope === 'SALE') qs.set('allocationId', targetId);
    try {
      targetHistory = await fetchApi<AgentAssignmentRow[]>(`/agent-assignments/by-target?${qs.toString()}`);
    } catch (e) {
      targetHistoryError = e instanceof ApiError ? e.message : 'Failed to load assignment history for this target.';
    }
  }


  return (
    <PageContainer>
      <PageHeader
        title="Agent Assignments"
        subtitle="Assign external sales agents to projects, units, and confirmed sales — primary, co-agent, and referral roles."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agent Assignments' }]}
      />

      <EntitySelector initialValue={entityId} />

      {!entityId && (
        <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Select an entity above to look up or create agent assignments.
        </div>
      )}

      {loadError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{loadError}</div>}

      {entityId && !loadError && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Active agents in entity" value={String(agents.length)} />
            <KpiCard label="Projects in entity" value={String(projects.length)} />
          </section>

          <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Create assignment</h2>
          <CreateAssignmentForm entityId={entityId} agentOptions={agents} projectOptions={projects} />

          <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>History by agent</h2>
          <AgentSelector entityId={entityId} agentOptions={agents} initialValue={searchParams.agentId} />
          {agentHistoryError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{agentHistoryError}</div>}
          {agentHistory && (
            <div style={{ marginBottom: tokens.space(8) }}>
              <AgentAssignmentsTable rows={agentHistory} agents={agents} emptyMessage="No assignments recorded for this agent." />
            </div>
          )}

          <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>History by target</h2>
          <TargetLookupForm
            entityId={entityId}
            projectOptions={projects}
            initialScope={searchParams.scope}
            initialProjectId={searchParams.projectId}
            initialUnitId={searchParams.unitId}
            initialAllocationId={searchParams.allocationId}
          />
          {targetHistoryError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{targetHistoryError}</div>}
          {targetHistory && (
            <AgentAssignmentsTable rows={targetHistory} agents={agents} emptyMessage="No assignments recorded for this target." />
          )}
        </>
      )}
    </PageContainer>
  );
}
