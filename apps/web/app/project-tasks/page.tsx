import { PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { ProjectSelector } from '../ProjectSelector';
import type { ProjectOption } from '../ProjectSelector';
import { CreateTaskForm } from './CreateTaskForm';
import { AddDependencyForm } from './AddDependencyForm';
import { CriticalPathTable, ProjectTasksTable } from './ProjectTasksTable';

export const dynamic = 'force-dynamic';

interface ProjectTask {
  id: string;
  code: string | null;
  name: string;
  parentTaskId: string | null;
  plannedStart: string;
  plannedEnd: string;
  percentComplete: number;
  status: string;
  isCritical: boolean;
}

interface CriticalPathTask {
  id: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  floatDays: number;
  isCritical: boolean;
}

interface CriticalPathResult {
  projectDurationDays: number;
  tasks: CriticalPathTask[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  ON_HOLD: 'warning',
  CANCELLED: 'negative',
};

async function fetchProjectOptions(entityId: string) {
  return fetchApi<ProjectOption[]>(`/dimensions/projects?entityId=${entityId}`);
}

/**
 * Frontend Completion, FE-5.1 â€” Project Tasks, first checkpoint of
 * Stage FE-5 (PMO). See `actions.ts`'s own doc comment for why this is
 * a genuine gap (not `/pmo`, not `tasks.controller.ts`) and why it
 * scopes to create/progress/status only.
 *
 * SAME `EntitySelector` â†’ `ProjectSelector` TWO-STEP GATE `/pmo`
 * ALREADY ESTABLISHED â€” `findTasks` takes an optional `projectId`
 * query param (confirmed directly), but `createTask` requires it, so
 * this page still gates the whole page on both being present rather
 * than showing an ungated, cross-project task list with a
 * per-project-only create form.
 *
 * `taskOptions` (for `CreateTaskForm`'s own `parentTaskId` field) is
 * built from the SAME `tasks` array this page's own table renders â€” no
 * separate fetch, same "reuse what's already in hand" shape
 * `land-bank/page.tsx`'s own `parcelOptions` uses.
 *
 * ADDENDUM (FE-5.2) â€” Scheduling: `AddDependencyForm` and a Critical
 * Path table are now rendered below the Tasks table, both gated on the
 * same `taskData` (i.e. `entityId` + `projectId` both present) this
 * page already requires. `computeCriticalPath` is fetched alongside
 * `findTasks` in the same `Promise.all` â€” see `actions.ts`'s own doc
 * comment on why no extra `revalidatePath` was needed for this. Unlike
 * `/pmo`'s own Gantt-data usage (a flattened task list, explicitly NOT
 * a chart â€” see that page's own doc comment), this table adds the
 * float/critical figures `computeCriticalPath` uniquely provides
 * (`/pmo`'s own Gantt fetch doesn't compute float at all) rather than
 * re-rendering the same task list a second time; a true bar-chart
 * Gantt view remains its own future visualization checkpoint, same as
 * `/pmo` already scoped it.
 */
async function loadScheduling(projectId: string) {
  const [tasks, criticalPath] = await Promise.all([
    fetchApi<ProjectTask[]>(`/project-tasks?projectId=${projectId}`),
    fetchApi<CriticalPathResult>(`/project-tasks/project/${projectId}/critical-path`),
  ]);
  return { tasks, criticalPath };
}

export default async function ProjectTasksPage({ searchParams }: { searchParams: { entityId?: string; projectId?: string } }) {
  const entityId = searchParams.entityId;
  const projectId = searchParams.projectId;

  let projectOptions: ProjectOption[] = [];
  if (entityId) {
    try {
      projectOptions = await fetchProjectOptions(entityId);
    } catch {
      projectOptions = [];
    }
  }

  let taskData: { projectId: string; tasks: ProjectTask[]; criticalPath: CriticalPathResult } | null = null;
  let tasksError: string | null = null;
  if (entityId && projectId) {
    try {
      const { tasks, criticalPath } = await loadScheduling(projectId);
      taskData = { projectId, tasks, criticalPath };
    } catch (e) {
      tasksError = e instanceof ApiError ? e.message : 'Failed to load tasks.';
    }
  }

  const taskOptions: SelectOption[] = (taskData?.tasks ?? []).map((t) => ({ value: t.id, label: t.code ? `${t.code} â€” ${t.name}` : t.name }));

  return (
    <PageContainer>
      <PageHeader
        title="Project Tasks"
        subtitle={projectId ? `Project ${projectId}` : 'Select an entity, then a project, to view its tasks.'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Project Tasks' }]}
      />
      <EntitySelector initialValue={entityId} />
      {entityId && <ProjectSelector entityId={entityId} projectOptions={projectOptions} initialValue={projectId} />}

      {tasksError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
          {tasksError}
        </div>
      )}

      {taskData && (
        <>
          <CreateTaskForm entityId={entityId!} projectId={taskData.projectId} taskOptions={taskOptions} />
          <ProjectTasksTable tasks={taskData.tasks} />

          <section style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Dependencies" />
            <AddDependencyForm taskOptions={taskOptions} />
          </section>

          <section>
            <PageHeader
              title="Critical path"
              subtitle={`Project duration: ${taskData.criticalPath.projectDurationDays} day${taskData.criticalPath.projectDurationDays === 1 ? '' : 's'}`}
            />
            <CriticalPathTable tasks={taskData.criticalPath.tasks} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
