import {
  DataTable,
  PageContainer,
  PageHeader,
  tokens,
} from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { SalaryStructureEditor } from './SalaryStructureEditor';
import { SalaryStructuresTable } from './SalaryStructureTables';

interface SalaryStructure {
  id: string;
  code: string;
  name: string;
  basicSalary?: number | string | null;
  housingAllowance?: number | string | null;
  transportAllowance?: number | string | null;
  otherAllowances?: number | string | null;
}

async function loadStructures(entityId: string) {
  return fetchApi<SalaryStructure[]>(
    `/hr/salary-structures?entityId=${encodeURIComponent(entityId)}`,
  );
}

export default async function SalaryStructuresPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Salary structures"
          subtitle="Select an entity to manage salary structures."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let structures: SalaryStructure[];

  try {
    structures = await loadStructures(entityId);
  } catch (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Salary structures"
          subtitle={
            error instanceof ApiError
              ? error.message
              : 'Failed to load salary structures.'
          }
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Salary structures"
        subtitle="Create and maintain the salary structures used by payroll."
      />

      <section style={{ marginBottom: tokens.space(8) }}>
        <SalaryStructuresTable rows={structures} />
      </section>

      <section>
        <PageHeader
          title="Edit salary structures"
          subtitle="Amounts are editable only for users with the appropriate HR management permission."
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.space(4),
          }}
        >
          {structures.map((structure) => (
            <SalaryStructureEditor
              key={structure.id}
              structure={structure}
            />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
