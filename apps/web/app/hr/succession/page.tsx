import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { AddCandidateForm } from './AddCandidateForm';
import { CreateSuccessionPlanForm } from './CreateSuccessionPlanForm';
import { UpdateReadinessForm } from './UpdateReadinessForm';

export const dynamic = 'force-dynamic';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
}

interface Candidate {
  id: string;
  employeeId: string;
  readiness: string;
  isHighPotential: boolean;
  developmentNotes?: string | null;
  employee: Employee;
}

interface Plan {
  id: string;
  positionTitle: string;
  incumbentEmployeeId?: string | null;
  criticality: string;
  notes?: string | null;
  incumbent?: Employee | null;
  candidates: Candidate[];
}

interface CoverageGap {
  successionPlanId: string;
  positionTitle: string;
  criticality: string;
  candidateCount: number;
}

interface HighPotential {
  employee: Employee;
  successionPlan: {
    positionTitle: string;
    criticality: string;
  };
}

async function loadData(entityId: string) {
  const [employees, plans, highPotentials, coverageGaps] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<Plan[]>(`/hr/succession/plans?entityId=${entityId}`),
    fetchApi<HighPotential[]>(`/hr/succession/high-potentials?entityId=${entityId}`),
    fetchApi<CoverageGap[]>(`/hr/succession/coverage-gaps?entityId=${entityId}`),
  ]);

  return { employees, plans, highPotentials, coverageGaps };
}

export default async function SuccessionPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Succession Planning"
          subtitle="Select an entity to manage leadership continuity and candidate readiness."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let error: string | null = null;

  try {
    data = await loadData(entityId);
  } catch (cause) {
    error =
      cause instanceof ApiError
        ? cause.message
        : 'Failed to load succession planning data.';
  }

  const employeeOptions: SelectOption[] = (data?.employees ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName}${employee.jobTitle ? ` — ${employee.jobTitle}` : ''}`,
  }));

  const planOptions: SelectOption[] = (data?.plans ?? []).map((plan) => ({
    value: plan.id,
    label: `${plan.positionTitle} — ${plan.criticality}`,
  }));

  const readyNowCount =
    data?.plans.reduce(
      (count, plan) =>
        count + plan.candidates.filter((candidate) => candidate.readiness === 'READY_NOW').length,
      0,
    ) ?? 0;

  const highPotentialCount = data?.highPotentials.length ?? 0;
  const gapCount = data?.coverageGaps.length ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Succession Planning"
        subtitle={`Entity ${entityId}`}
      />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div
          style={{
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            marginBottom: tokens.space(6),
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Succession plans" value={String(data.plans.length)} />
            <KpiCard label="Ready now candidates" value={String(readyNowCount)} tone={readyNowCount > 0 ? 'positive' : 'warning'} />
            <KpiCard label="High potentials" value={String(highPotentialCount)} />
            <KpiCard label="Coverage gaps" value={String(gapCount)} tone={gapCount === 0 ? 'positive' : 'negative'} />
          </section>

          <PageHeader
            title="Create succession plan"
            subtitle="Define a critical position and its current incumbent."
          />
          <CreateSuccessionPlanForm
            entityId={entityId}
            employeeOptions={employeeOptions}
          />

          <PageHeader
            title="Add succession candidate"
            subtitle="Map an employee to a position and record readiness."
          />
          <AddCandidateForm
            planOptions={planOptions}
            employeeOptions={employeeOptions}
          />

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Coverage gaps" subtitle="High and critical roles without a ready-now successor." />
            {data.coverageGaps.length === 0 ? (
              <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
                No succession coverage gaps identified.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: tokens.font.body }}>
                <thead>
                  <tr>
                    {['Position', 'Criticality', 'Candidates'].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: 'left',
                          padding: tokens.space(3),
                          borderBottom: `1px solid ${tokens.color.border}`,
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.coverageGaps.map((gap) => (
                    <tr key={gap.successionPlanId}>
                      <td style={{ padding: tokens.space(3) }}>{gap.positionTitle}</td>
                      <td style={{ padding: tokens.space(3) }}>
                        <Badge tone="negative">{gap.criticality}</Badge>
                      </td>
                      <td style={{ padding: tokens.space(3) }}>{gap.candidateCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="High-potential pipeline" />
            {data.highPotentials.length === 0 ? (
              <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
                No high-potential candidates recorded.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: tokens.font.body }}>
                <thead>
                  <tr>
                    {['Employee', 'Position', 'Criticality'].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: 'left',
                          padding: tokens.space(3),
                          borderBottom: `1px solid ${tokens.color.border}`,
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.highPotentials.map((item) => (
                    <tr key={`${item.employee.id}-${item.successionPlan.positionTitle}`}>
                      <td style={{ padding: tokens.space(3) }}>
                        {item.employee.firstName} {item.employee.lastName}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {item.successionPlan.positionTitle}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {item.successionPlan.criticality}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <PageHeader title="Succession plans" />
            {data.plans.length === 0 ? (
              <div style={{ fontFamily: tokens.font.body, fontSize: '13px' }}>
                No succession plans created for this entity.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: tokens.space(4) }}>
                {data.plans.map((plan) => (
                  <article
                    key={plan.id}
                    style={{
                      border: `1px solid ${tokens.color.border}`,
                      borderRadius: tokens.radius.md,
                      padding: tokens.space(4),
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: tokens.space(3),
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: tokens.font.body, fontWeight: 600 }}>
                          {plan.positionTitle}
                        </div>
                        <div style={{ fontFamily: tokens.font.body, fontSize: '12px' }}>
                          {plan.incumbent
                            ? `Incumbent: ${plan.incumbent.firstName} ${plan.incumbent.lastName}`
                            : 'No incumbent assigned'}
                        </div>
                      </div>
                      <Badge tone={plan.criticality === 'CRITICAL' ? 'negative' : plan.criticality === 'HIGH' ? 'warning' : 'neutral'}>
                        {plan.criticality}
                      </Badge>
                    </div>

                    {plan.candidates.length === 0 ? (
                      <div style={{ marginTop: tokens.space(4), fontFamily: tokens.font.body, fontSize: '13px' }}>
                        No candidates mapped yet.
                      </div>
                    ) : (
                      <div style={{ marginTop: tokens.space(4), display: 'grid', gap: tokens.space(4) }}>
                        {plan.candidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            style={{
                              borderTop: `1px solid ${tokens.color.border}`,
                              paddingTop: tokens.space(3),
                            }}
                          >
                            <div style={{ fontFamily: tokens.font.body, fontWeight: 500 }}>
                              {candidate.employee.firstName} {candidate.employee.lastName}
                              {candidate.isHighPotential ? ' — High potential' : ''}
                            </div>
                            <UpdateReadinessForm
                              candidateId={candidate.id}
                              initialReadiness={candidate.readiness}
                              initialNotes={candidate.developmentNotes}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
