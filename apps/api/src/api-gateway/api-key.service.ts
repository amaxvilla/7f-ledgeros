import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiKeyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { GenerateApiKeyDto, RevokeApiKeyDto } from './dto/api-key.dto';

const KEY_PREFIX = '7f_live_';
const RAW_KEY_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = 12; // "7f_live_" + first 4 hex chars — enough to recognize a key in a list without exposing anything useful

/**
 * API Gateway, Checkpoint A — API Keys.
 *
 * The inbound counterpart to this codebase's outbound *ProviderRegistry
 * abstractions — see the schema's own ApiKey doc comment for the full
 * reasoning, including why keyHash reuses AuthService.hashToken()'s
 * exact sha256 convention rather than bcrypt.
 *
 * generateKey() is the ONLY place the plaintext key ever exists outside
 * the caller's own request — it is not stored anywhere, not logged, and
 * cannot be recovered later; losing it means generating a new key.
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /** Returns the plaintext key ONCE, alongside the persisted (hash-only) record. Callers must show `plaintextKey` to the user immediately and never request it again. */
  async generateKey(dto: GenerateApiKeyDto, createdById: string) {
    const rawKey = `${KEY_PREFIX}${crypto.randomBytes(RAW_KEY_BYTES).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, DISPLAY_PREFIX_LENGTH);

    const record = await this.prisma.apiKey.create({
      data: {
        entityId: dto.entityId,
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        rateLimitPerMinute: dto.rateLimitPerMinute,
        createdById,
      },
    });

    return { plaintextKey: rawKey, apiKey: record };
  }

  findKeys(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] });
    // Explicit select — never return keyHash, even though it's a
    // one-way hash, on general "don't expose internal secrets" hygiene.
    return this.prisma.apiKey.findMany({
      where: { AND: [rls, { entityId }] },
      select: {
        id: true,
        entityId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        expiresAt: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireKey(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException(`API key ${id} not found`);
    return key;
  }

  async revokeKey(id: string, _dto: RevokeApiKeyDto, revokedById: string) {
    const key = await this.requireKey(id);
    if (key.status === ApiKeyStatus.REVOKED) {
      throw new ConflictException('API key is already revoked');
    }
    return this.prisma.apiKey.update({
      where: { id },
      data: { status: ApiKeyStatus.REVOKED, revokedAt: new Date(), revokedById },
    });
  }

  /** Validates a raw key presented by a caller (e.g. via ApiKeyGuard's
   *  X-API-Key header) — hash lookup, ACTIVE status, not expired.
   *  Updates lastUsedAt on every successful validation (best-effort;
   *  a failed write here should never block the request it's tracking,
   *  so this is fire-and-forget rather than awaited). */
  async validateKey(rawKey: string) {
    const keyHash = this.hashKey(rawKey);
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!key || key.status !== ApiKeyStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

    return key;
  }
}
