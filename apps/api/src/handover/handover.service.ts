import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HandoverStatus, SnagSeverity, SnagSource, SnagStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { RevenueRecognitionService } from '../revenue-recognition/revenue-recognition.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AddSnagDto,
  CancelHandoverDto,
  CompleteHandoverDto,
  RejectSnagDto,
  ResolveSnagDto,
  ScheduleHandoverDto,
} from './dto/handover.dto';

@Injectable()
export class HandoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly revenueRecognition: RevenueRecognitionService,
    private readonly notifications: NotificationsService,
  ) {}

  // =====================================================================
  // HANDOVER RECORD
  // =====================================================================

  async scheduleHandover(dto: ScheduleHandoverDto, createdById: string) {
    const allocation = await this.prisma.unitSaleAllocation.findUnique({ where: { id: dto.allocationId } });
    if (!allocation) throw new NotFoundException(`Unit sale allocation ${dto.allocationId} not found`);

    const existing = await this.prisma.handoverRecord.findUnique({ where: { allocationId: dto.allocationId } });
    if (existing) throw new ConflictException('This allocation already has a handover record');

    return this.prisma.handoverRecord.create({
      data: {
        allocationId: dto.allocationId,
        entityId: dto.entityId,
        unitId: dto.unitId,
        customerId: dto.customerId,
        scheduledDate: new Date(dto.scheduledDate),
        createdById,
      },
    });
  }

  findHandoverRecords(scope: SecurityScope, filters: { status?: HandoverStatus; entityId?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.handoverRecord.findMany({
      where: { AND: [rls, filters] },
      include: { unit: true, customer: true, snags: true },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  /**
   * Customer Portal (additive) — every handover record for one customer,
   * newest first, including its own snags. Deliberately NOT RLS-scoped
   * like findHandoverRecords above: the caller here is an external
   * customer, not an internal SecurityScope-bearing user, matching the
   * candidate-portal's own "portal permission is the gate, not RLS"
   * precedent (CandidatePortalController.profile/myApplications).
   */
  findRecordsForCustomer(customerId: string) {
    return this.prisma.handoverRecord.findMany({
      where: { customerId },
      include: { unit: true, snags: { orderBy: { createdAt: 'desc' } } },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  async getHandoverRecord(id: string) {
    const record = await this.prisma.handoverRecord.findUnique({
      where: { id },
      include: { unit: true, customer: true, allocation: true, snags: { orderBy: { createdAt: 'desc' } } },
    });
    if (!record) throw new NotFoundException(`Handover record ${id} not found`);
    return record;
  }

  private async requireHandoverRecord(id: string) {
    const record = await this.prisma.handoverRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Handover record ${id} not found`);
    return record;
  }

  private assertHandoverOpen(record: { status: HandoverStatus }) {
    if (record.status === HandoverStatus.COMPLETED || record.status === HandoverStatus.CANCELLED) {
      throw new ConflictException(`Handover is already ${record.status}`);
    }
  }

  async recordInspection(id: string) {
    const record = await this.requireHandoverRecord(id);
    this.assertHandoverOpen(record);
    return this.prisma.handoverRecord.update({
      where: { id },
      data: { status: HandoverStatus.INSPECTION_DONE, inspectedAt: new Date() },
    });
  }

  async cancelHandover(id: string, dto: CancelHandoverDto) {
    const record = await this.requireHandoverRecord(id);
    this.assertHandoverOpen(record);
    return this.prisma.handoverRecord.update({
      where: { id },
      data: { status: HandoverStatus.CANCELLED, cancelledReason: dto.reason },
    });
  }

  /**
   * Completes the handover: refuses to proceed while any snag is still
   * OPEN/IN_PROGRESS, then reuses
   * RevenueRecognitionService.recognizeOnHandover() (Phase 4, unchanged)
   * for the GL entry and the Unit/Allocation status flip to HANDED_OVER —
   * that logic is not duplicated here.
   */
  async completeHandover(id: string, dto: CompleteHandoverDto, handedOverById: string) {
    const record = await this.requireHandoverRecord(id);
    this.assertHandoverOpen(record);

    const openSnags = await this.prisma.snagItem.count({
      where: { handoverRecordId: id, status: { in: [SnagStatus.OPEN, SnagStatus.IN_PROGRESS] } },
    });
    if (openSnags > 0) {
      throw new BadRequestException(`Cannot complete handover: ${openSnags} snag(s) are still open`);
    }

    const { journalEntry } = await this.revenueRecognition.recognizeOnHandover({
      entityId: record.entityId,
      unitId: record.unitId,
      entryDate: dto.entryDate,
      salePrice: dto.salePrice,
      costOfUnit: dto.costOfUnit,
      deferredRevenueGlId: dto.deferredRevenueGlId,
      propertySalesRevenueGlId: dto.propertySalesRevenueGlId,
      costOfSalesGlId: dto.costOfSalesGlId,
      propertyInventoryGlId: dto.propertyInventoryGlId,
      systemUserId: handedOverById,
    } as never);

    const updated = await this.prisma.handoverRecord.update({
      where: { id },
      data: {
        status: HandoverStatus.COMPLETED,
        completedAt: new Date(),
        customerSignedAt: new Date(),
        handedOverById,
      },
    });

    return { handoverRecord: updated, journalEntry };
  }

  // =====================================================================
  // SNAG LIST / DEFECT TRACKING (shared model — see schema comment)
  // =====================================================================

  async addSnag(handoverRecordId: string, dto: AddSnagDto, reportedById: string) {
    const record = await this.requireHandoverRecord(handoverRecordId);

    const snag = await this.prisma.snagItem.create({
      data: {
        handoverRecordId,
        unitId: record.unitId,
        description: dto.description,
        category: dto.category,
        severity: dto.severity ?? SnagSeverity.MINOR,
        source: dto.source ?? SnagSource.HANDOVER_INSPECTION,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        reportedById,
      },
    });

    // Release F — Notifications API wiring: this is the first caller of
    // NotificationsService.create in the codebase. Best-effort — a
    // notification failure (e.g. Redis briefly unavailable) must never
    // block snag creation itself, so it's caught and logged rather than
    // left to fail the whole request.
    if (dto.assignedToId) {
      try {
        await this.notifications.create({
          userId: dto.assignedToId,
          title: 'New snag assigned',
          body: dto.description,
          metadata: { snagId: snag.id, handoverRecordId, unitId: record.unitId },
        });
      } catch {
        // Non-fatal — see comment above. The snag itself is already saved.
      }
    }

    // Any open snag against an otherwise-inspected handover blocks completion.
    if (record.status === HandoverStatus.INSPECTION_DONE) {
      await this.prisma.handoverRecord.update({ where: { id: handoverRecordId }, data: { status: HandoverStatus.SNAGS_PENDING } });
    }

    return snag;
  }

  findSnags(filters: { unitId?: string; handoverRecordId?: string; status?: SnagStatus }) {
    return this.prisma.snagItem.findMany({ where: filters, orderBy: { createdAt: 'desc' } });
  }

  private async requireSnag(id: string) {
    const snag = await this.prisma.snagItem.findUnique({ where: { id } });
    if (!snag) throw new NotFoundException(`Snag ${id} not found`);
    return snag;
  }

  async startSnagWork(id: string) {
    await this.requireSnag(id);
    return this.prisma.snagItem.update({ where: { id }, data: { status: SnagStatus.IN_PROGRESS } });
  }

  async resolveSnag(id: string, dto: ResolveSnagDto) {
    await this.requireSnag(id);
    return this.prisma.snagItem.update({
      where: { id },
      data: { status: SnagStatus.RESOLVED, resolvedAt: new Date(), resolvedNotes: dto.resolvedNotes },
    });
  }

  async verifySnag(id: string, verifiedById: string) {
    const snag = await this.requireSnag(id);
    if (snag.status !== SnagStatus.RESOLVED) {
      throw new ConflictException(`Only a RESOLVED snag can be verified (currently ${snag.status})`);
    }
    return this.prisma.snagItem.update({ where: { id }, data: { status: SnagStatus.VERIFIED, verifiedAt: new Date(), verifiedById } });
  }

  async rejectSnag(id: string, dto: RejectSnagDto) {
    await this.requireSnag(id);
    return this.prisma.snagItem.update({
      where: { id },
      data: { status: SnagStatus.REJECTED, resolvedNotes: dto.reason },
    });
  }

  /** Snag-list summary for a dashboard widget — counts by status/severity for a unit or the whole entity via unit filter upstream. */
  async getSnagSummary(handoverRecordId?: string) {
    const where = handoverRecordId ? { handoverRecordId } : {};
    const [byStatus, bySeverity] = await Promise.all([
      this.prisma.snagItem.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.snagItem.groupBy({ by: ['severity'], where, _count: true }),
    ]);
    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      bySeverity: bySeverity.map((r) => ({ severity: r.severity, count: r._count })),
    };
  }
}
