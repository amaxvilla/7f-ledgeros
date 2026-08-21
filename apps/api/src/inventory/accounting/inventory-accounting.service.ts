import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import {
  InventoryAccountConfiguration,
  InventoryAccountRole,
  InventoryAccountingEvent,
  InventoryPostingContext,
  InventoryPostingResult,
} from './inventory-accounting.types';

@Injectable()
export class InventoryAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
  ) {}

  private async resolveConfig(
    entityId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<InventoryAccountConfiguration> {
    const config = await tx.inventoryAccountingConfig.findUnique({
      where: { entityId },
    });

    if (!config || !config.isActive) {
      throw new BadRequestException(
        `Inventory accounting configuration is not active for entity ${entityId}`,
      );
    }

    const accountIds = [
      config.inventoryAssetAccountId,
      config.grniAccountId,
      config.cogsAccountId,
      config.inventoryGainAccountId,
      config.inventoryLossAccountId,
    ];

    const accounts = await tx.account.findMany({
      where: {
        id: { in: accountIds },
        isActive: true,
        isPostable: true,
      },
      select: { id: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException(
        `One or more inventory accounts are inactive or invalid for entity ${entityId}`,
      );
    }

    const activations = await tx.entityAccount.findMany({
      where: {
        entityId,
        accountId: { in: accountIds },
        isActive: true,
      },
      select: { accountId: true },
    });

    if (activations.length !== accountIds.length) {
      throw new BadRequestException(
        `One or more inventory accounts are not activated for entity ${entityId}`,
      );
    }

    return config;
  }

  async resolveAccount(
    entityId: string,
    role: InventoryAccountRole,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const config = await this.resolveConfig(entityId, tx ?? this.prisma);

    switch (role) {
      case 'INVENTORY_ASSET':
        return config.inventoryAssetAccountId;
      case 'GRNI':
        return config.grniAccountId;
      case 'COGS':
        return config.cogsAccountId;
      case 'INVENTORY_GAIN':
        return config.inventoryGainAccountId;
      case 'INVENTORY_LOSS':
        return config.inventoryLossAccountId;
      default:
        throw new BadRequestException(`Unsupported inventory account role: ${role}`);
    }
  }

  async postInventoryEvent(
    event: InventoryAccountingEvent,
    context: InventoryPostingContext,
    inventoryValue: number,
    systemUserId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryPostingResult | null> {
    if (!Number.isFinite(inventoryValue) || inventoryValue <= 0) {
      return null;
    }

    if (!context.entityId || !context.sourceId || !context.sourceType) {
      throw new BadRequestException('Inventory accounting source context is incomplete');
    }

    const client = tx ?? this.prisma;

    const config = await this.resolveConfig(context.entityId, client);

    let lines: {
      accountId: string;
      debit: number;
      credit: number;
      memo?: string;
    }[] = [];

    switch (event) {
      case 'RECEIPT':
        lines = [
          {
            accountId: config.inventoryAssetAccountId,
            debit: inventoryValue,
            credit: 0,
            memo: 'Inventory receipt',
          },
          {
            accountId: config.grniAccountId,
            debit: 0,
            credit: inventoryValue,
            memo: 'GRNI accrual',
          },
        ];
        break;

      case 'ISSUE':
        lines = [
          {
            accountId: config.cogsAccountId,
            debit: inventoryValue,
            credit: 0,
            memo: 'Weighted-average COGS',
          },
          {
            accountId: config.inventoryAssetAccountId,
            debit: 0,
            credit: inventoryValue,
            memo: 'Inventory issue',
          },
        ];
        break;

      case 'COUNT_VARIANCE':
        if (inventoryValue > 0) {
          lines = [
            {
              accountId: config.inventoryAssetAccountId,
              debit: inventoryValue,
              credit: 0,
              memo: 'Inventory count gain',
            },
            {
              accountId: config.inventoryGainAccountId,
              debit: 0,
              credit: inventoryValue,
              memo: 'Inventory gain',
            },
          ];
        }
        break;

      case 'ADJUSTMENT':
        lines = [
          {
            accountId: config.inventoryLossAccountId,
            debit: inventoryValue,
            credit: 0,
            memo: 'Inventory adjustment loss',
          },
          {
            accountId: config.inventoryAssetAccountId,
            debit: 0,
            credit: inventoryValue,
            memo: 'Inventory adjustment',
          },
        ];
        break;

      case 'TRANSFER':
        return null;

      case 'VENDOR_INVOICE_CLEAR_GRNI':
        lines = [
          {
            accountId: config.grniAccountId,
            debit: inventoryValue,
            credit: 0,
            memo: 'Clear GRNI',
          },
          {
            accountId: config.inventoryAssetAccountId,
            debit: 0,
            credit: inventoryValue,
            memo: 'Inventory invoice clearing',
          },
        ];
        break;

      default:
        throw new BadRequestException(`Unsupported inventory accounting event: ${event}`);
    }

    if (lines.length !== 2) {
      return null;
    }

    const posted = tx
      ? await this.postingEngine.postSystemEntryInTransaction(
          tx,
          {
            entityId: context.entityId,
            entryDate: context.postingDate,
            description:
              context.description ??
              `Inventory ${event.toLowerCase()} ${context.sourceId}`,
            sourceType: 'INVENTORY',
            sourceReference: context.sourceId,
            lines,
          } as never,
          systemUserId,
        )
      : await this.postingEngine.postSystemEntry(
          {
            entityId: context.entityId,
            entryDate: context.postingDate,
            description:
              context.description ??
              `Inventory ${event.toLowerCase()} ${context.sourceId}`,
            sourceType: 'INVENTORY',
            sourceReference: context.sourceId,
            lines,
          } as never,
          systemUserId,
        );

    return {
      journalEntryId: posted.id,
      totalDebit: lines.reduce((sum, line) => sum + Number(line.debit), 0),
      totalCredit: lines.reduce((sum, line) => sum + Number(line.credit), 0),
      balanced: true,
    };
  }

  async configure(
    entityId: string,
    input: Omit<InventoryAccountConfiguration, 'entityId' | 'isActive'>,
  ) {
    await this.resolveAccountCandidates(entityId, input);

    return this.prisma.inventoryAccountingConfig.upsert({
      where: { entityId },
      create: {
        entityId,
        inventoryAssetAccountId: input.inventoryAssetAccountId,
        grniAccountId: input.grniAccountId,
        cogsAccountId: input.cogsAccountId,
        inventoryGainAccountId: input.inventoryGainAccountId,
        inventoryLossAccountId: input.inventoryLossAccountId,
        isActive: true,
      },
      update: {
        inventoryAssetAccountId: input.inventoryAssetAccountId,
        grniAccountId: input.grniAccountId,
        cogsAccountId: input.cogsAccountId,
        inventoryGainAccountId: input.inventoryGainAccountId,
        inventoryLossAccountId: input.inventoryLossAccountId,
        isActive: true,
      },
    });
  }

  async getConfiguration(entityId: string) {
    return this.prisma.inventoryAccountingConfig.findUnique({
      where: { entityId },
    });
  }

  private async resolveAccountCandidates(
    entityId: string,
    input: Omit<InventoryAccountConfiguration, 'entityId' | 'isActive'>,
  ) {
    const ids = [
      input.inventoryAssetAccountId,
      input.grniAccountId,
      input.cogsAccountId,
      input.inventoryGainAccountId,
      input.inventoryLossAccountId,
    ];

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Inventory accounting roles must use valid account mappings',
      );
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        isPostable: true,
      },
      select: { id: true },
    });

    if (accounts.length !== ids.length) {
      throw new BadRequestException(
        'One or more inventory accounts are invalid or inactive',
      );
    }

    const activations = await this.prisma.entityAccount.findMany({
      where: {
        entityId,
        accountId: { in: ids },
        isActive: true,
      },
      select: { accountId: true },
    });

    if (activations.length !== ids.length) {
      throw new BadRequestException(
        'Every inventory account must be activated for the selected entity',
      );
    }
  }
}
