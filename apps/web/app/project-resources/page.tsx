import { KpiCard, PageContainer, PageHeader, tokens } from "@7f/ui";
import { fetchApi, ApiError } from "../../lib/api";
import { EntitySelector } from "../EntitySelector";
import { ProjectSelector } from "../ProjectSelector";
import type { ProjectOption } from "../ProjectSelector";
import { CreateResourceForm } from "./CreateResourceForm";
import { CreateAllocationForm } from "./CreateAllocationForm";
import { ProjectResourcesTables } from './ProjectResourcesTables';
import type {
  Resource,
  UtilizationRow,
  ProjectTask,
  Allocation,
} from './ProjectResourcesTables';

export const dynamic = "force-dynamic";



async function loadProjects(entityId: string) {
  return fetchApi<ProjectOption[]>(
    `/dimensions/projects?entityId=${entityId}`,
  );
}

async function loadWorkspace(entityId: string, projectId: string) {
  const [resources, utilization, tasks, allocations] = await Promise.all([
    fetchApi<Resource[]>(
      `/project-resources?projectId=${projectId}`,
    ),
    fetchApi<UtilizationRow[]>(
      `/project-resources/utilization?projectId=${projectId}`,
    ),
    fetchApi<ProjectTask[]>(
      `/project-tasks?projectId=${projectId}`,
    ),
    fetchApi<Allocation[]>(
      `/resource-allocations`,
    ),
  ]);

  return {
    resources,
    utilization,
    tasks,
    allocations: allocations.filter(
      (allocation) => allocation.resource?.projectId === projectId,
    ),
  };
}

export default async function ProjectResourcesPage({
  searchParams,
}: {
  searchParams: {
    entityId?: string;
    projectId?: string;
  };
}) {
  const entityId = searchParams.entityId;
  const projectId = searchParams.projectId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Project Resources"
          subtitle="Select an entity to manage labour and equipment resources."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let projects: ProjectOption[] = [];
  let projectError: string | null = null;

  try {
    projects = await loadProjects(entityId);
  } catch (error) {
    projectError =
      error instanceof ApiError
        ? error.message
        : "Failed to load projects.";
  }

  if (!projectId) {
    return (
      <PageContainer>
        <PageHeader
          title="Project Resources"
          subtitle={`Entity ${entityId} — select a project.`}
        />
        <EntitySelector initialValue={entityId} />

        {projectError ? (
          <div
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
            }}
          >
            {projectError}
          </div>
        ) : (
          <ProjectSelector
            entityId={entityId}
            projectOptions={projects}
          />
        )}
      </PageContainer>
    );
  }

  let workspace: Awaited<ReturnType<typeof loadWorkspace>> | null = null;
  let error: string | null = null;

  try {
    workspace = await loadWorkspace(entityId, projectId);
  } catch (e) {
    error =
      e instanceof ApiError
        ? e.message
        : "Failed to load project resources.";
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  const labourCount =
    workspace?.resources.filter((r) => r.type === "LABOUR").length ?? 0;

  const equipmentCount =
    workspace?.resources.filter((r) => r.type === "EQUIPMENT").length ?? 0;

  const activeAllocations =
    workspace?.allocations.filter(
      (a) => a.status === "PLANNED" || a.status === "ACTIVE",
    ).length ?? 0;

  const resourceOptions =
    workspace?.resources
      .filter((r) => r.isActive)
      .map((r) => ({
        value: r.id,
        label: `${r.name}${r.code ? ` (${r.code})` : ""}`,
      })) ?? [];

  const taskOptions =
    workspace?.tasks
      .filter((task) => task.status !== "CANCELLED")
      .map((task) => ({
        value: task.id,
        label: `${task.code ? `${task.code} — ` : ""}${task.name}`,
      })) ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Project Resources"
        subtitle={
          selectedProject
            ? `${selectedProject.code} — ${selectedProject.name}`
            : `Project ${projectId}`
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "PMO", href: "/pmo" },
          { label: "Project Resources" },
        ]}
      />

      <EntitySelector initialValue={entityId} />

      <ProjectSelector
        entityId={entityId}
        projectOptions={projects}
        initialValue={projectId}
      />

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

      {workspace && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard
              label="Total resources"
              value={String(workspace.resources.length)}
            />
            <KpiCard
              label="Labour"
              value={String(labourCount)}
              tone="positive"
            />
            <KpiCard
              label="Equipment"
              value={String(equipmentCount)}
              tone="warning"
            />
            <KpiCard
              label="Open allocations"
              value={String(activeAllocations)}
              tone={activeAllocations > 0 ? "warning" : "neutral"}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Register resource"
              subtitle="Add labour crews or equipment to this project."
            />
            <CreateResourceForm
              entityId={entityId}
              projectId={projectId}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Resource utilization"
              subtitle="Committed PLANNED and ACTIVE allocations against each resource capacity."
            />

            <ProjectResourcesTables
              resources={workspace.resources}
              utilization={workspace.utilization}
              allocations={workspace.allocations}
            />
          </section>


          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Create allocation"
              subtitle="Assign a resource to a project task for a defined date range."
            />

            {resourceOptions.length === 0 ||
            taskOptions.length === 0 ? (
              <div
                style={{
                  padding: tokens.space(4),
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.color.textMuted,
                  fontFamily: tokens.font.body,
                }}
              >
                Create at least one active resource and one project task
                before creating an allocation.
              </div>
            ) : (
              <CreateAllocationForm
                entityId={entityId}
                resources={resourceOptions}
                tasks={taskOptions}
              />
            )}
          </section>

        </>
      )}
    </PageContainer>
  );
}
