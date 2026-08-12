import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAuthSecurityPolicyDto, ChangePasswordDto } from './dto/security-hardening.dto';

/**
 * Password Policy Engine (Release K). Reuses bcrypt exactly as
 * AuthService already does (same hash rounds convention) rather than
 * introducing a second hashing scheme. Only the GLOBAL policy
 * (entityId = null) is resolved for login-time/change-time validation in
 * this release — per-entity policies can be created via
 * upsertPolicy({entityId}) for future use, but AuthService has no entity
 * context at authentication time, so resolving one now would mean
 * guessing which entity's policy applies. See the release report for
 * this known limitation.
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePolicy(entityId?: string) {
    if (entityId) {
      const scoped = await this.prisma.authSecurityPolicy.findUnique({ where: { entityId } });
      if (scoped && scoped.isActive) return scoped;
    }
    const global = await this.prisma.authSecurityPolicy.findFirst({ where: { entityId: null, isActive: true } });
    return global ?? this.defaultPolicy();
  }

  /** Used when no AuthSecurityPolicy row exists yet — the schema's own
   *  column defaults, so behavior is identical whether or not an admin
   *  has explicitly created a policy row. */
  private defaultPolicy() {
    return {
      id: null,
      entityId: null,
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: false,
      expiryDays: null as number | null,
      historyCount: 5,
      maxFailedLoginAttempts: 5,
      lockoutDurationMinutes: 30,
      isActive: true,
    };
  }

  async upsertPolicy(dto: UpsertAuthSecurityPolicyDto, createdById: string) {
    const entityId = dto.entityId ?? null;
    // AuthSecurityPolicy.entityId is a nullable @unique column. Prisma's
    // findUnique cannot search by `null` on a nullable unique field (Postgres
    // doesn't treat NULLs as equal under a unique index), so the global
    // policy (entityId = null) must be looked up with findFirst instead —
    // same pattern already used in getEffectivePolicy().
    const existing = entityId
      ? await this.prisma.authSecurityPolicy.findUnique({ where: { entityId } })
      : await this.prisma.authSecurityPolicy.findFirst({ where: { entityId: null } });
    const data = {
      minLength: dto.minLength,
      requireUppercase: dto.requireUppercase,
      requireLowercase: dto.requireLowercase,
      requireNumber: dto.requireNumber,
      requireSymbol: dto.requireSymbol,
      expiryDays: dto.expiryDays,
      historyCount: dto.historyCount,
      maxFailedLoginAttempts: dto.maxFailedLoginAttempts,
      lockoutDurationMinutes: dto.lockoutDurationMinutes,
    };
    if (existing) {
      return this.prisma.authSecurityPolicy.update({ where: { id: existing.id }, data });
    }
    return this.prisma.authSecurityPolicy.create({ data: { entityId, createdById, ...data } });
  }

  findPolicies() {
    return this.prisma.authSecurityPolicy.findMany({ orderBy: { entityId: 'asc' } });
  }

  /** Throws BadRequestException with a specific reason if the plaintext
   *  password doesn't satisfy the policy's complexity rules. */
  validateComplexity(plainPassword: string, policy: { minLength: number; requireUppercase: boolean; requireLowercase: boolean; requireNumber: boolean; requireSymbol: boolean }) {
    const problems: string[] = [];
    if (plainPassword.length < policy.minLength) problems.push(`at least ${policy.minLength} characters`);
    if (policy.requireUppercase && !/[A-Z]/.test(plainPassword)) problems.push('an uppercase letter');
    if (policy.requireLowercase && !/[a-z]/.test(plainPassword)) problems.push('a lowercase letter');
    if (policy.requireNumber && !/[0-9]/.test(plainPassword)) problems.push('a number');
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(plainPassword)) problems.push('a symbol');
    if (problems.length > 0) {
      throw new BadRequestException(`Password must contain ${problems.join(', ')}`);
    }
  }

  /** Checks the new password against the last `historyCount` hashes for
   *  this user — reuse prevention. */
  async assertNotReused(userId: string, plainPassword: string, historyCount: number) {
    if (historyCount <= 0) return;
    const recent = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: historyCount,
    });
    for (const entry of recent) {
      if (await bcrypt.compare(plainPassword, entry.passwordHash)) {
        throw new BadRequestException(`Password must not match any of your last ${historyCount} passwords`);
      }
    }
  }

  isExpired(passwordChangedAt: Date | null, expiryDays: number | null): boolean {
    if (!expiryDays || !passwordChangedAt) return false;
    const expiresAt = new Date(passwordChangedAt);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    return expiresAt < new Date();
  }

  /** Validates the current password, enforces the effective policy on
   *  the new one (complexity + reuse), updates User.passwordHash /
   *  passwordChangedAt, and records the OLD hash into PasswordHistory
   *  (so the new password itself becomes checkable once it's eventually
   *  replaced, without ever storing the plaintext). */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    const policy = await this.getEffectivePolicy();
    this.validateComplexity(dto.newPassword, policy);
    await this.assertNotReused(userId, dto.newPassword, policy.historyCount);

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.passwordHistory.create({ data: { userId, passwordHash: user.passwordHash } });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash, passwordChangedAt: new Date() } });

    // Prune history beyond historyCount so this table doesn't grow unbounded.
    const excess = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: policy.historyCount,
      select: { id: true },
    });
    if (excess.length > 0) {
      await this.prisma.passwordHistory.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
    }

    return { success: true };
  }
}
