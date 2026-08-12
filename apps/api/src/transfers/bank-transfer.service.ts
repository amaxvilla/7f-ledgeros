import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BankTransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { TransferProviderRegistry } from './transfer-provider.registry';
import { CreateBankTransferRecordDto } from './dto/bank-transfer.dto';

/**
 * Transfer APIs, Checkpoint B — record management only.
 *
 * Deliberately does NOT call TransferProviderRegistry / actually
 * initiate anything with a bank yet — there's no concrete
 * TransferProvider registered until a later checkpoint (see
 * transfers.module.ts's own Checkpoint A comment). This is the "make
 * the model usable at all" layer, the same scope MonoLinkedAccountService
 * had before MonoProvider's real fetchStatement/fetchBalance existed to
 * call — record management first, provider orchestration once there's a
 * provider to orchestrate.
 *
 * IDEMPOTENCY: createRecord() checks for an existing row by `reference`
 * FIRST and returns it unchanged rather than attempting an insert that
 * the database's own UNIQUE constraint would then reject — a friendlier
 * idempotent-API shape than surfacing a raw constraint-violation error
 * to a caller that retried the exact same reference on purpose. The
 * UNIQUE constraint itself (see the Checkpoint B migration) remains the
 * actual guarantee; this is a courtesy layer on top of it, not a
 * replacement for it — a race between two concurrent calls with the
 * same reference still resolves correctly at the database level even if
 * this pre-check's own read is stale.
 *
 * Checkpoint E — provider orchestration. `initiateTransfer(id)` is
 * deliberately a SEPARATE step from createRecord(), not folded into it
 * (a caller creates a record, then separately calls
 * initiateTransfer(record.id)) — this is exactly the seam
 * transfer-provider.interface.ts's own Checkpoint A doc comment
 * predicted for a future approval gate: "a transfer's approval, if
 * enabled, is a pre-initiation gate on whoever calls initiateTransfer()"
 * — a future TransferPolicy layer can sit between record creation and
 * this method being called, holding a transfer at PENDING until
 * approved, without this method's own contract changing at all.
 *
 * UNLIKE the best-effort, swallow-and-flag sync patterns elsewhere in
 * this codebase (InterviewService's calendar sync, CandidateService's
 * contact sync, HseService's task sync), a provider failure here is
 * RE-THROWN, not swallowed — those integrations are secondary side
 * effects of a record that already fully exists on its own terms; a
 * bank transfer's provider call IS the entire point of calling
 * initiateTransfer(), so a caller unconditionally needs to know it
 * failed rather than receiving a quiet 200 with a FAILED-status record
 * they might not think to check. The failure is still persisted
 * (status FAILED + failureReason) before re-throwing, so the record
 * itself is never left stuck at a stale PENDING that no longer reflects
 * reality.
 *
 * Checkpoint F — status verification. verifyTransfer(id) fills the gap
 * this file's own Checkpoint E comment (applyProviderResult) predicted —
 * see that method's doc comment for why its error handling is
 * deliberately asymmetric with initiateTransfer's. Provider-push
 * (webhook) status updates remain a future checkpoint; this one is
 * pull/polling only.
 */
@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly transferProviders: TransferProviderRegistry,
  ) {}

  async createRecord(dto: CreateBankTransferRecordDto, initiatedById: string) {
    const existing = await this.prisma.bankTransfer.findUnique({ where: { reference: dto.reference } });
    if (existing) return existing;

    return this.prisma.bankTransfer.create({
      data: {
        entityId: dto.entityId,
        providerCode: dto.providerCode,
        reference: dto.reference,
        amount: dto.amount,
        currency: dto.currency ?? 'NGN',
        recipientAccountNumber: dto.recipientAccountNumber,
        recipientBankCode: dto.recipientBankCode,
        recipientName: dto.recipientName,
        narration: dto.narration,
        initiatedById,
      },
    });
  }

  /**
   * Calls the record's own providerCode's TransferProvider.initiateTransfer()
   * and persists the result. Idempotent at THIS layer too, on top of
   * createRecord()'s own reference-based idempotency: a record that has
   * already moved past PENDING, or already has a providerTransferId
   * (the provider call already landed, successfully or not), is
   * returned as-is rather than calling the provider a second time —
   * critical here specifically, since a duplicate call could mean a
   * duplicate real-world bank transfer, not just a duplicate database
   * row the way a duplicate createRecord() call would be.
   */
  async initiateTransfer(id: string) {
    const record = await this.getRecord(id);
    if (record.status !== BankTransferStatus.PENDING || record.providerTransferId) {
      return record;
    }

    const provider = this.transferProviders.get(record.providerCode);
    try {
      const result = await provider.initiateTransfer({
        amount: Number(record.amount),
        currency: record.currency,
        recipientAccountNumber: record.recipientAccountNumber,
        recipientBankCode: record.recipientBankCode,
        recipientName: record.recipientName ?? undefined,
        reference: record.reference,
        narration: record.narration ?? undefined,
      });

      return await this.applyProviderResult(record.id, {
        providerTransferId: result.providerTransferId,
        status: result.status as BankTransferStatus,
      });
    } catch (err) {
      this.logger.warn(`Failed to initiate transfer for bank transfer ${record.id} (reference=${record.reference}): ${(err as Error).message}`);
      await this.applyProviderResult(record.id, { status: BankTransferStatus.FAILED, failureReason: (err as Error).message }).catch((persistErr) => {
        this.logger.warn(`Could not persist FAILED status for bank transfer ${record.id}: ${(persistErr as Error).message}`);
      });
      throw err;
    }
  }

  /**
   * Transfer APIs, Checkpoint F — status verification. Re-checks a
   * transfer's CURRENT status directly with its provider — the exact
   * gap applyProviderResult's own doc comment (Checkpoint E) predicted:
   * "a future verify/webhook checkpoint". Deliberately callable
   * regardless of the record's current status (not just PENDING) — a
   * reconciliation sweep re-verifying an already-SUCCESSFUL record to
   * confirm it's still accurate is a legitimate call, not an error.
   *
   * ERROR HANDLING IS DELIBERATELY ASYMMETRIC WITH initiateTransfer:
   * a verify-call failure (network error, provider outage) means the
   * STATUS CHECK failed, not that the TRANSFER failed — the transfer
   * itself may be perfectly fine; we simply couldn't confirm it right
   * now. So unlike initiateTransfer, this method does NOT mark the
   * record FAILED on a provider-call error — it just re-throws, leaving
   * the record's last-known status untouched for the caller to retry
   * later.
   */
  async verifyTransfer(id: string) {
    const record = await this.getRecord(id);
    if (record.status === BankTransferStatus.PENDING && !record.providerTransferId) {
      throw new ConflictException(`Bank transfer ${id} has not been initiated yet — call initiateTransfer first`);
    }

    const provider = this.transferProviders.get(record.providerCode);
    const result = await provider.verifyTransfer(record.reference);

    return this.applyProviderResult(record.id, {
      providerTransferId: result.providerTransferId,
      status: result.status as BankTransferStatus,
      completedAt: result.completedAt,
      failureReason: result.failureReason,
    });
  }

  findRecords(scope: SecurityScope, filters: { entityId?: string; status?: BankTransferStatus; providerCode?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] });
    return this.prisma.bankTransfer.findMany({ where: { AND: [rls, filters] }, orderBy: { createdAt: 'desc' } });
  }

  async getRecord(id: string) {
    const record = await this.prisma.bankTransfer.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Bank transfer ${id} not found`);
    return record;
  }

  getByReference(reference: string) {
    return this.prisma.bankTransfer.findUnique({ where: { reference } });
  }

  /** For provider-orchestration callers (initiateTransfer(), verifyTransfer()
   *  above, and a future webhook checkpoint) to call once a real
   *  provider result comes back — intentionally generic
   *  (providerTransferId/status/failureReason/completedAt all optional)
   *  rather than several single-purpose setters. */
  async applyProviderResult(
    id: string,
    patch: { providerTransferId?: string; status?: BankTransferStatus; failureReason?: string; completedAt?: Date },
  ) {
    await this.getRecord(id);
    return this.prisma.bankTransfer.update({ where: { id }, data: patch });
  }
}
