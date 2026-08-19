'use client';

import * as React from 'react';
import { Badge, Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import {
  assessEmployeeCompetency,
  createPerformanceCompetency,
  createPerformanceGoal,
  createPerformanceKpi,
  updatePerformanceGoalProgress,
  updatePerformanceKpiActual,
} from '../actions';

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  weight?: number | string | null;
  progressPercent: number | string;
  status: string;
  targetDate?: string | null;
}

interface Kpi {
  id: string;
  name: string;
  targetValue: number | string;
  actualValue?: number | string | null;
  unit?: string | null;
  weight?: number | string | null;
}

interface Competency {
  id: string;
  name: string;
  description?: string | null;
}

interface Assessment {
  id: string;
  rating: number | string;
  comments?: string | null;
  competency: {
    id: string;
    name: string;
  };
}

export function PerformanceManagementPanel({
  employeeOptions,
  competencyOptions,
  goals,
  kpis,
  assessments,
}: {
  employeeOptions: SelectOption[];
  competencyOptions: SelectOption[];
  goals: Goal[];
  kpis: Kpi[];
  assessments: Assessment[];
}) {
  const [employeeId, setEmployeeId] = React.useState(employeeOptions[0]?.value ?? '');
  const [cycleId, setCycleId] = React.useState('');

  const [goalTitle, setGoalTitle] = React.useState('');
  const [goalDescription, setGoalDescription] = React.useState('');
  const [goalWeight, setGoalWeight] = React.useState('');
  const [goalTargetDate, setGoalTargetDate] = React.useState('');
  const [goalPending, setGoalPending] = React.useState(false);

  const [kpiName, setKpiName] = React.useState('');
  const [kpiTarget, setKpiTarget] = React.useState('');
  const [kpiUnit, setKpiUnit] = React.useState('');
  const [kpiWeight, setKpiWeight] = React.useState('');
  const [kpiPending, setKpiPending] = React.useState(false);

  const [competencyName, setCompetencyName] = React.useState('');
  const [competencyDescription, setCompetencyDescription] = React.useState('');
  const [competencyPending, setCompetencyPending] = React.useState(false);

  const [selectedCompetency, setSelectedCompetency] = React.useState('');
  const [rating, setRating] = React.useState('3');
  const [assessmentComments, setAssessmentComments] = React.useState('');
  const [assessmentPending, setAssessmentPending] = React.useState(false);

  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function clearStatus() {
    setMessage(null);
    setError(null);
  }

  async function submitGoal(event: React.FormEvent) {
    event.preventDefault();
    clearStatus();

    if (!employeeId || !goalTitle.trim()) {
      setError('Employee and goal title are required.');
      return;
    }

    setGoalPending(true);

    const result = await createPerformanceGoal({
      employeeId,
      cycleId: cycleId.trim() || undefined,
      title: goalTitle.trim(),
      description: goalDescription.trim() || undefined,
      weight: goalWeight ? Number(goalWeight) : undefined,
      targetDate: goalTargetDate || undefined,
    });

    setGoalPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to create goal.');
      return;
    }

    setGoalTitle('');
    setGoalDescription('');
    setGoalWeight('');
    setGoalTargetDate('');
    setMessage('Goal created.');
  }

  async function submitKpi(event: React.FormEvent) {
    event.preventDefault();
    clearStatus();

    if (!employeeId || !kpiName.trim() || !kpiTarget) {
      setError('Employee, KPI name and target value are required.');
      return;
    }

    setKpiPending(true);

    const result = await createPerformanceKpi({
      employeeId,
      cycleId: cycleId.trim() || undefined,
      name: kpiName.trim(),
      targetValue: Number(kpiTarget),
      unit: kpiUnit.trim() || undefined,
      weight: kpiWeight ? Number(kpiWeight) : undefined,
    });

    setKpiPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to create KPI.');
      return;
    }

    setKpiName('');
    setKpiTarget('');
    setKpiUnit('');
    setKpiWeight('');
    setMessage('KPI created.');
  }

  async function submitCompetency(event: React.FormEvent) {
    event.preventDefault();
    clearStatus();

    if (!competencyName.trim()) {
      setError('Competency name is required.');
      return;
    }

    setCompetencyPending(true);

    const result = await createPerformanceCompetency({
      name: competencyName.trim(),
      description: competencyDescription.trim() || undefined,
    });

    setCompetencyPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to create competency.');
      return;
    }

    setCompetencyName('');
    setCompetencyDescription('');
    setMessage('Competency created.');
  }

  async function submitAssessment(event: React.FormEvent) {
    event.preventDefault();
    clearStatus();

    if (!employeeId || !selectedCompetency) {
      setError('Employee and competency are required.');
      return;
    }

    const numericRating = Number(rating);

    if (numericRating < 1 || numericRating > 5) {
      setError('Competency rating must be between 1 and 5.');
      return;
    }

    setAssessmentPending(true);

    const result = await assessEmployeeCompetency({
      employeeId,
      competencyId: selectedCompetency,
      cycleId: cycleId.trim() || undefined,
      rating: numericRating,
      comments: assessmentComments.trim() || undefined,
    });

    setAssessmentPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Failed to record assessment.');
      return;
    }

    setAssessmentComments('');
    setMessage('Competency assessment recorded.');
  }

  async function changeGoalProgress(id: string, current: number) {
    const value = window.prompt('Enter progress percentage (0-100):', String(current));

    if (value === null) return;

    const progress = Number(value);

    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      setError('Progress must be between 0 and 100.');
      return;
    }

    clearStatus();

    const result = await updatePerformanceGoalProgress(id, progress);

    if (!result.ok) {
      setError(result.error ?? 'Failed to update goal progress.');
      return;
    }

    setMessage('Goal progress updated.');
  }

  async function changeKpiActual(id: string, current?: number | string | null) {
    const value = window.prompt(
      'Enter actual KPI value:',
      current == null ? '' : String(current),
    );

    if (value === null || value.trim() === '') return;

    const actual = Number(value);

    if (!Number.isFinite(actual)) {
      setError('KPI actual value must be numeric.');
      return;
    }

    clearStatus();

    const result = await updatePerformanceKpiActual(id, actual);

    if (!result.ok) {
      setError(result.error ?? 'Failed to update KPI actual.');
      return;
    }

    setMessage('KPI actual value updated.');
  }

  const selectedEmployeeLabel =
    employeeOptions.find((option) => option.value === employeeId)?.label ?? 'Employee';

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 420px) minmax(220px, 1fr)',
          gap: tokens.space(3),
          marginBottom: tokens.space(4),
        }}
      >
        <Select
          label="Employee"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          options={employeeOptions}
          placeholder="Select employee"
        />
        <TextField
          label="Cycle ID (optional)"
          value={cycleId}
          onChange={(event) => setCycleId(event.target.value)}
          placeholder="Leave blank for outside-cycle tracking"
        />
      </div>

      {(message || error) && (
        <div
          style={{
            marginBottom: tokens.space(4),
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: error ? tokens.color.negative : tokens.color.positive,
          }}
        >
          {error ?? message}
        </div>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <h3 style={{ fontFamily: tokens.font.body, color: tokens.color.textPrimary }}>
          Goals / OKRs
        </h3>

        <form
          onSubmit={submitGoal}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: tokens.space(3),
            padding: tokens.space(4),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            marginBottom: tokens.space(4),
          }}
        >
          <TextField
            label="Goal title"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            required
          />
          <TextField
            label="Description"
            value={goalDescription}
            onChange={(event) => setGoalDescription(event.target.value)}
          />
          <TextField
            label="Weight"
            type="number"
            value={goalWeight}
            onChange={(event) => setGoalWeight(event.target.value)}
          />
          <TextField
            label="Target date"
            type="date"
            value={goalTargetDate}
            onChange={(event) => setGoalTargetDate(event.target.value)}
          />
          <Button type="submit" disabled={goalPending}>
            {goalPending ? 'Creating…' : 'Create goal'}
          </Button>
        </form>

        {goals.length === 0 ? (
          <p style={{ fontFamily: tokens.font.body, color: tokens.color.textMuted }}>
            No goals recorded for {selectedEmployeeLabel}.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>Goal</th>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>Progress</th>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>Status</th>
                  <th style={{ textAlign: 'right', padding: tokens.space(2) }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal) => (
                  <tr key={goal.id}>
                    <td style={{ padding: tokens.space(2) }}>{goal.title}</td>
                    <td style={{ padding: tokens.space(2) }}>{String(goal.progressPercent)}%</td>
                    <td style={{ padding: tokens.space(2) }}>
                      <Badge tone={goal.status === 'COMPLETED' ? 'positive' : 'neutral'}>
                        {goal.status}
                      </Badge>
                    </td>
                    <td style={{ padding: tokens.space(2), textAlign: 'right' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void changeGoalProgress(goal.id, Number(goal.progressPercent))}
                      >
                        Update
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h3 style={{ fontFamily: tokens.font.body, color: tokens.color.textPrimary }}>
          KPIs
        </h3>

        <form
          onSubmit={submitKpi}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: tokens.space(3),
            padding: tokens.space(4),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            marginBottom: tokens.space(4),
          }}
        >
          <TextField
            label="KPI name"
            value={kpiName}
            onChange={(event) => setKpiName(event.target.value)}
            required
          />
          <TextField
            label="Target value"
            type="number"
            value={kpiTarget}
            onChange={(event) => setKpiTarget(event.target.value)}
            required
          />
          <TextField
            label="Unit"
            value={kpiUnit}
            onChange={(event) => setKpiUnit(event.target.value)}
          />
          <TextField
            label="Weight"
            type="number"
            value={kpiWeight}
            onChange={(event) => setKpiWeight(event.target.value)}
          />
          <Button type="submit" disabled={kpiPending}>
            {kpiPending ? 'Creating…' : 'Create KPI'}
          </Button>
        </form>

        {kpis.length === 0 ? (
          <p style={{ fontFamily: tokens.font.body, color: tokens.color.textMuted }}>
            No KPIs recorded for {selectedEmployeeLabel}.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>KPI</th>
                  <th style={{ textAlign: 'right', padding: tokens.space(2) }}>Target</th>
                  <th style={{ textAlign: 'right', padding: tokens.space(2) }}>Actual</th>
                  <th style={{ textAlign: 'right', padding: tokens.space(2) }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.id}>
                    <td style={{ padding: tokens.space(2) }}>{kpi.name}</td>
                    <td style={{ padding: tokens.space(2), textAlign: 'right' }}>
                      {String(kpi.targetValue)} {kpi.unit ?? ''}
                    </td>
                    <td style={{ padding: tokens.space(2), textAlign: 'right' }}>
                      {kpi.actualValue == null ? '—' : String(kpi.actualValue)}
                    </td>
                    <td style={{ padding: tokens.space(2), textAlign: 'right' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void changeKpiActual(kpi.id, kpi.actualValue)}
                      >
                        Record actual
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h3 style={{ fontFamily: tokens.font.body, color: tokens.color.textPrimary }}>
          Competency catalogue
        </h3>

        <form
          onSubmit={submitCompetency}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: tokens.space(3),
            padding: tokens.space(4),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            marginBottom: tokens.space(4),
          }}
        >
          <TextField
            label="Competency name"
            value={competencyName}
            onChange={(event) => setCompetencyName(event.target.value)}
            required
          />
          <TextField
            label="Description"
            value={competencyDescription}
            onChange={(event) => setCompetencyDescription(event.target.value)}
          />
          <Button type="submit" disabled={competencyPending}>
            {competencyPending ? 'Creating…' : 'Create competency'}
          </Button>
        </form>

        {competencyOptions.length === 0 ? (
          <p style={{ fontFamily: tokens.font.body, color: tokens.color.textMuted }}>
            No competencies are currently defined.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: tokens.space(2), flexWrap: 'wrap' }}>
            {competencyOptions.map((option) => (
              <Badge key={option.value} tone="neutral">
                {option.label}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontFamily: tokens.font.body, color: tokens.color.textPrimary }}>
          Competency assessments
        </h3>

        <form
          onSubmit={submitAssessment}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: tokens.space(3),
            padding: tokens.space(4),
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            marginBottom: tokens.space(4),
          }}
        >
          <Select
            label="Competency"
            value={selectedCompetency}
            onChange={(event) => setSelectedCompetency(event.target.value)}
            options={competencyOptions}
            placeholder="Select competency"
          />
          <TextField
            label="Rating (1-5)"
            type="number"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            min={1}
            max={5}
          />
          <TextField
            label="Comments"
            value={assessmentComments}
            onChange={(event) => setAssessmentComments(event.target.value)}
          />
          <Button type="submit" disabled={assessmentPending}>
            {assessmentPending ? 'Saving…' : 'Record assessment'}
          </Button>
        </form>

        {assessments.length === 0 ? (
          <p style={{ fontFamily: tokens.font.body, color: tokens.color.textMuted }}>
            No competency assessments recorded for {selectedEmployeeLabel}.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>Competency</th>
                  <th style={{ textAlign: 'right', padding: tokens.space(2) }}>Rating</th>
                  <th style={{ textAlign: 'left', padding: tokens.space(2) }}>Comments</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td style={{ padding: tokens.space(2) }}>
                      {assessment.competency.name}
                    </td>
                    <td style={{ padding: tokens.space(2), textAlign: 'right' }}>
                      {String(assessment.rating)}
                    </td>
                    <td style={{ padding: tokens.space(2) }}>
                      {assessment.comments ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
