import {
  Badge,
  DataTable,
  KpiCard,
  PageContainer,
  PageHeader,
  tokens,
} from "@7f/ui";
import { fetchApi, ApiError, formatCurrency } from "../../lib/api";
import { EntitySelector } from "../EntitySelector";
import { ProjectSelector } from "../ProjectSelector";
import type { ProjectOption } from "../ProjectSelector";
import { CreateResourceForm } from "./CreateResourceForm";
import { CreateAllocationForm } from "./CreateAllocationForm";
import { AllocationActions } from "./AllocationActions";

export const dynamic = "force-dynamic";

interface Resource {
  id: string;
  projectId: string;
  entityId: string;
  type: "LABOUR" | "EQUIPMENT";
  name: string;
  code: string | null;
  unitOfMeasure: string | null;
  unitCost: number | string | null;
  capacity: number | string | null;
  isActive: boolean;
}

interface UtilizationRow {
  resourceId: string;
  name: string;
  type: "LABOUR" | "EQUIPMENT";
  capacity: number | string | null;
  committed: number | string;
  utilizationPct: number | null;
}

interface ProjectTask {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Allocation {
  id: string;
  resourceId: string;
  taskId: string;
  entityId: string;
  startDate: string;
  endDate: string;
  plannedQuantity: number | string;
  actualQuantity: number | string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  resource: Resource;
  task: ProjectTask;
}

const RESOURCE_TONE: Record<
  Resource["type"],
  "positive" | "warning" | "neutral"
> = {
  LABOUR: "positive",
  EQUIPMENT: "warning",
};

const ALLOCATION_TONE: Record<
  Allocation["status"],
  "positive" | "negative" | "warning" | "neutral"
> = {
  PLANNED: "neutral",
  ACTIVE: "warning",
  COMPLETED: "positive",
  CANCELLED: "negative",
};

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

            <DataTable
              columns={[
                {
                  header: "Resource",
                  render: (r: UtilizationRow) => r.name,
                },
                {
                  header: "Type",
                  render: (r: UtilizationRow) => (
                    <Badge tone={RESOURCE_TONE[r.type]}>
                      {r.type}
                    </Badge>
                  ),
                },
                {
                  header: "Capacity",
                  align: "right",
                  render: (r: UtilizationRow) =>
                    r.capacity == null ? "—" : String(r.capacity),
                },
                {
                  header: "Committed",
                  align: "right",
                  render: (r: UtilizationRow) =>
                    String(r.committed),
                },
                {
                  header: "Utilization",
                  align: "right",
                  render: (r: UtilizationRow) =>
                    r.utilizationPct == null
                      ? "—"
                      : `${r.utilizationPct}%`,
                },
              ]}
              rows={workspace.utilization}
              keyOf={(r) => r.resourceId}
              emptyMessage="No active resources for this project."
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Resources"
              subtitle="Resource pool available for project allocation."
            />

            <DataTable
              columns={[
                {
                  header: "Resource",
                  render: (r: Resource) => r.name,
                },
                {
                  header: "Code",
                  render: (r: Resource) => r.code ?? "—",
                },
                {
                  header: "Type",
                  render: (r: Resource) => (
                    <Badge tone={RESOURCE_TONE[r.type]}>
                      {r.type}
                    </Badge>
                  ),
                },
                {
                  header: "Unit cost",
                  align: "right",
                  render: (r: Resource) =>
                    r.unitCost == null
                      ? "—"
                      : formatCurrency(Number(r.unitCost)),
                },
                {
                  header: "Capacity",
                  align: "right",
                  render: (r: Resource) =>
                    r.capacity == null ? "—" : String(r.capacity),
                },
                {
                  header: "Status",
                  render: (r: Resource) => (
                    <Badge
                      tone={r.isActive ? "positive" : "neutral"}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  ),
                },
              ]}
              rows={workspace.resources}
              keyOf={(r) => r.id}
              emptyMessage="No resources registered for this project."
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

          <section>
            <PageHeader
              title="Allocations"
              subtitle="Track planned, active, completed and cancelled resource assignments."
            />

            <DataTable
              columns={[
                {
                  header: "Resource",
                  render: (a: Allocation) => a.resource?.name ?? a.resourceId,
                },
                {
                  header: "Task",
                  render: (a: Allocation) =>
                    a.task?.name ?? a.taskId,
                },
                {
                  header: "Start",
                  render: (a: Allocation) =>
                    new Date(a.startDate).toLocaleDateString(),
                },
                {
                  header: "End",
                  render: (a: Allocation) =>
                    new Date(a.endDate).toLocaleDateString(),
                },
                {
                  header: "Planned",
                  align: "right",
                  render: (a: Allocation) =>
                    String(a.plannedQuantity),
                },
                {
                  header: "Actual",
                  align: "right",
                  render: (a: Allocation) =>
                    a.actualQuantity == null
                      ? "—"
                      : String(a.actualQuantity),
                },
                {
                  header: "Status",
                  render: (a: Allocation) => (
                    <Badge tone={ALLOCATION_TONE[a.status]}>
                      {a.status}
                    </Badge>
                  ),
                },
                {
                  header: "Actions",
                  align: "right",
                  render: (a: Allocation) => (
                    <AllocationActions
                      id={a.id}
                      status={a.status}
                    />
                  ),
                },
              ]}
              rows={workspace.allocations}
              keyOf={(a) => a.id}
              emptyMessage="No allocations for this project."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
