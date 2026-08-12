import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DimensionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Real estate hierarchy: Project -> Phase -> Block -> Floor -> Unit ----

  async createProject(entityId: string, code: string, name: string, description?: string) {
    await this.assertUnique('project', { entityId, code });
    return this.prisma.project.create({ data: { entityId, code, name, description } });
  }

  findProjects(entityId?: string) {
    return this.prisma.project.findMany({
      where: entityId ? { entityId } : undefined,
      include: { phases: true },
      orderBy: { code: 'asc' },
    });
  }

  async createPhase(projectId: string, code: string, name: string) {
    await this.assertParentExists('project', projectId);
    await this.assertUnique('phase', { projectId, code });
    return this.prisma.phase.create({ data: { projectId, code, name } });
  }

  async createBlock(phaseId: string, code: string, name: string) {
    await this.assertParentExists('phase', phaseId);
    await this.assertUnique('block', { phaseId, code });
    return this.prisma.block.create({ data: { phaseId, code, name } });
  }

  async createFloor(blockId: string, code: string, name: string) {
    await this.assertParentExists('block', blockId);
    await this.assertUnique('floor', { blockId, code });
    return this.prisma.floor.create({ data: { blockId, code, name } });
  }

  async createUnit(
    floorId: string,
    data: { code: string; name?: string; unitType?: string; sizeSqm?: number; listPrice: number },
  ) {
    await this.assertParentExists('floor', floorId);
    await this.assertUnique('unit', { floorId, code: data.code });
    return this.prisma.unit.create({ data: { floorId, ...data } });
  }

  getProjectTree(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        phases: {
          include: {
            blocks: {
              include: {
                floors: { include: { units: true } },
              },
            },
          },
        },
      },
    });
  }

  // ---- Organizational dimensions ----

  async createDepartment(entityId: string, code: string, name: string) {
    await this.assertUnique('department', { entityId, code });
    return this.prisma.department.create({ data: { entityId, code, name } });
  }

  findDepartments(entityId?: string) {
    return this.prisma.department.findMany({ where: entityId ? { entityId } : undefined });
  }

  async createCostCenter(entityId: string, code: string, name: string) {
    await this.assertUnique('costCenter', { entityId, code });
    return this.prisma.costCenter.create({ data: { entityId, code, name } });
  }

  findCostCenters(entityId?: string) {
    return this.prisma.costCenter.findMany({ where: entityId ? { entityId } : undefined });
  }

  async createFundingSource(entityId: string, code: string, name: string, sourceType?: string) {
    await this.assertUnique('fundingSource', { entityId, code });
    return this.prisma.fundingSource.create({ data: { entityId, code, name, sourceType } });
  }

  findFundingSources(entityId?: string) {
    return this.prisma.fundingSource.findMany({ where: entityId ? { entityId } : undefined });
  }

  // ---- Counterparties ----

  async createVendor(code: string, name: string, extra?: { taxId?: string; bankName?: string; bankAccountNumber?: string }) {
    const existing = await this.prisma.vendor.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Vendor code "${code}" already exists`);
    return this.prisma.vendor.create({ data: { code, name, ...extra } });
  }

  findVendors() {
    return this.prisma.vendor.findMany({ orderBy: { code: 'asc' } });
  }

  async createCustomer(code: string, name: string, extra?: { email?: string; phone?: string }) {
    const existing = await this.prisma.customer.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Customer code "${code}" already exists`);
    return this.prisma.customer.create({ data: { code, name, ...extra } });
  }

  findCustomers() {
    return this.prisma.customer.findMany({ orderBy: { code: 'asc' } });
  }

  // ---- Internal helpers ----

  private async assertParentExists(model: 'project' | 'phase' | 'block' | 'floor', id: string) {
    const found = await (this.prisma[model] as any).findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`${model} ${id} not found`);
  }

  private async assertUnique(
    model: 'project' | 'phase' | 'block' | 'floor' | 'unit' | 'department' | 'costCenter' | 'fundingSource',
    where: Record<string, string>,
  ) {
    const compoundKeyMap: Record<string, string> = {
      project: 'entityId_code',
      phase: 'projectId_code',
      block: 'phaseId_code',
      floor: 'blockId_code',
      unit: 'floorId_code',
      department: 'entityId_code',
      costCenter: 'entityId_code',
      fundingSource: 'entityId_code',
    };
    const keyName = compoundKeyMap[model];
    const existing = await (this.prisma[model] as any).findUnique({
      where: { [keyName]: where },
    });
    if (existing) {
      throw new ConflictException(
        `${model} with code "${where.code}" already exists under this parent`,
      );
    }
  }
}
