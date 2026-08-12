import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';

@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEntityDto) {
    const existing = await this.prisma.entity.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Entity code "${dto.code}" is already in use`);
    }

    if (dto.parentEntityId) {
      const parent = await this.prisma.entity.findUnique({ where: { id: dto.parentEntityId } });
      if (!parent) {
        throw new NotFoundException(`Parent entity ${dto.parentEntityId} not found`);
      }
    }

    return this.prisma.entity.create({
      data: {
        code: dto.code,
        name: dto.name,
        legalName: dto.legalName,
        taxIdentificationNumber: dto.taxIdentificationNumber,
        registrationNumber: dto.registrationNumber,
        baseCurrency: dto.baseCurrency ?? 'NGN',
        fiscalYearStartMonth: dto.fiscalYearStartMonth ?? 1,
        parentEntityId: dto.parentEntityId,
        isConsolidationParent: dto.isConsolidationParent ?? false,
      },
    });
  }

  findAll() {
    return this.prisma.entity.findMany({
      include: { subsidiaries: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: { subsidiaries: true, parentEntity: true },
    });
    if (!entity) {
      throw new NotFoundException(`Entity ${id} not found`);
    }
    return entity;
  }

  async update(id: string, dto: UpdateEntityDto) {
    await this.findOne(id);
    return this.prisma.entity.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.entity.update({ where: { id }, data: { isActive: false } });
  }

  /** Returns the full parent chain up to the group root, root first. */
  async getHierarchyChain(id: string) {
    const chain = [];
    let current = await this.findOne(id);
    chain.unshift(current);
    while (current.parentEntityId) {
      current = await this.findOne(current.parentEntityId);
      chain.unshift(current);
    }
    return chain;
  }
}
