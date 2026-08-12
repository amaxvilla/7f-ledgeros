import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Account code "${dto.code}" already exists in the group chart`);
    }

    if (dto.parentAccountId) {
      const parent = await this.prisma.account.findUnique({ where: { id: dto.parentAccountId } });
      if (!parent) {
        throw new NotFoundException(`Parent account ${dto.parentAccountId} not found`);
      }
    }

    return this.prisma.account.create({ data: dto });
  }

  findAll(params?: { accountType?: string; activeOnly?: boolean }) {
    return this.prisma.account.findMany({
      where: {
        ...(params?.accountType ? { accountType: params.accountType as never } : {}),
        ...(params?.activeOnly ? { isActive: true } : {}),
      },
      include: { childAccounts: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { childAccounts: true, parentAccount: true },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.account.update({ where: { id }, data: { isActive: false } });
  }

  /** Activates a group-chart account for use by a specific entity. */
  async activateForEntity(dto: ActivateAccountDto) {
    const [entity, account] = await Promise.all([
      this.prisma.entity.findUnique({ where: { id: dto.entityId } }),
      this.prisma.account.findUnique({ where: { id: dto.accountId } }),
    ]);
    if (!entity) throw new NotFoundException(`Entity ${dto.entityId} not found`);
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);

    return this.prisma.entityAccount.upsert({
      where: { entityId_accountId: { entityId: dto.entityId, accountId: dto.accountId } },
      create: { entityId: dto.entityId, accountId: dto.accountId, isActive: true },
      update: { isActive: true },
    });
  }

  async deactivateForEntity(entityId: string, accountId: string) {
    return this.prisma.entityAccount.update({
      where: { entityId_accountId: { entityId, accountId } },
      data: { isActive: false },
    });
  }

  /** Accounts an entity may post to — used for dropdown population and posting validation. */
  async findActiveForEntity(entityId: string) {
    const activations = await this.prisma.entityAccount.findMany({
      where: { entityId, isActive: true, account: { isActive: true, isPostable: true } },
      include: { account: true },
    });
    return activations.map((a) => a.account);
  }
}
