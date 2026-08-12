import { Injectable } from '@nestjs/common';
import { isFeatureEnabled, DEFAULT_FEATURE_FLAGS, type FeatureFlagRecord } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class FeatureFlagsService {
  private cache = new Map<string, { record: FeatureFlagRecord; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently creates any default flags not yet present. Safe to call on every boot. */
  async ensureDefaults(): Promise<void> {
    for (const flag of DEFAULT_FEATURE_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: { key: flag.key, description: flag.description, enabled: flag.enabled },
        update: {},
      });
    }
  }

  async isEnabled(key: string, subjectId?: string): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return isFeatureEnabled(cached.record, subjectId);
    }

    const row = await this.prisma.featureFlag.findUnique({ where: { key } });
    const record: FeatureFlagRecord | null = row
      ? { key: row.key, enabled: row.enabled, rolloutPercent: row.rolloutPercent }
      : null;

    if (record) {
      this.cache.set(key, { record, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return isFeatureEnabled(record, subjectId);
  }
}
