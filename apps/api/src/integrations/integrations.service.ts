import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationCategory, IntegrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationEncryptionService } from './integration-encryption.service';
import { INTEGRATION_DRIVER_REGISTRY, NoopIntegrationDriver } from './integration-provider-driver.interface';
import {
  CreateIntegrationProviderDto,
  RotateIntegrationCredentialsDto,
  UpdateIntegrationProviderDto,
} from './dto/integration-provider.dto';

const noopDriver = new NoopIntegrationDriver();

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  async createProvider(dto: CreateIntegrationProviderDto, createdById: string) {
    const provider = await this.prisma.integrationProvider.create({
      data: {
        entityId: dto.entityId,
        category: dto.category,
        providerCode: dto.providerCode,
        name: dto.name,
        config: (dto.config ?? undefined) as never,
        encryptedCredentials: dto.credentials ? this.encryption.encrypt(dto.credentials) : undefined,
        retryMaxAttempts: dto.retryMaxAttempts ?? undefined,
        retryBackoffMs: dto.retryBackoffMs ?? undefined,
        createdById,
      },
    });
    return this.redact(provider);
  }

  async findProviders(filters: { entityId?: string; category?: IntegrationCategory; status?: IntegrationStatus }) {
    const providers = await this.prisma.integrationProvider.findMany({
      where: {
        entityId: filters.entityId,
        category: filters.category,
        status: filters.status,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return providers.map((p) => this.redact(p));
  }

  async getProvider(id: string) {
    return this.redact(await this.requireProvider(id));
  }

  async updateProvider(id: string, dto: UpdateIntegrationProviderDto) {
    await this.requireProvider(id);
    const updated = await this.prisma.integrationProvider.update({
      where: { id },
      data: {
        name: dto.name,
        config: (dto.config ?? undefined) as never,
        isActive: dto.isActive,
        retryMaxAttempts: dto.retryMaxAttempts,
        retryBackoffMs: dto.retryBackoffMs,
      },
    });
    return this.redact(updated);
  }

  /** Dedicated endpoint (rather than folding into updateProvider) so credential rotation is its own auditable action. */
  async rotateCredentials(id: string, dto: RotateIntegrationCredentialsDto) {
    await this.requireProvider(id);
    const updated = await this.prisma.integrationProvider.update({
      where: { id },
      data: { encryptedCredentials: this.encryption.encrypt(dto.credentials) },
    });
    return this.redact(updated);
  }

  /**
   * Decrypted credentials for a driver's own use only. Deliberately not
   * called from IntegrationsController — no HTTP route ever returns a
   * decrypted secret. Later-release provider drivers (S3, Twilio, ...)
   * call this directly as an injected service.
   */
  async getDecryptedCredentials(id: string): Promise<Record<string, unknown> | null> {
    const provider = await this.requireProvider(id);
    return provider.encryptedCredentials ? this.encryption.decrypt(provider.encryptedCredentials) : null;
  }

  /** Runs the registered driver's health check (or the no-op fallback) and persists the result onto the row. */
  async runHealthCheck(id: string) {
    const provider = await this.requireProvider(id);
    const driver = INTEGRATION_DRIVER_REGISTRY[provider.providerCode] ?? noopDriver;
    const credentials = provider.encryptedCredentials ? this.encryption.decrypt(provider.encryptedCredentials) : null;

    let result: { ok: boolean; message?: string };
    try {
      result = await driver.healthCheck({ config: (provider.config as Record<string, unknown> | null) ?? null, credentials });
    } catch (err) {
      result = { ok: false, message: (err as Error).message };
    }

    const updated = await this.prisma.integrationProvider.update({
      where: { id },
      data: {
        status: !provider.isActive ? IntegrationStatus.INACTIVE : result.ok ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR,
        lastHealthCheckAt: new Date(),
        lastHealthCheckOk: result.ok,
        lastHealthCheckError: result.ok ? null : (result.message ?? 'Health check failed'),
      },
    });
    return this.redact(updated);
  }

  /** Called by the scheduled worker job (and available for an on-demand "check everything now" action). */
  async runHealthCheckAll() {
    const active = await this.prisma.integrationProvider.findMany({ where: { isActive: true }, select: { id: true } });
    const results = await Promise.all(active.map((p) => this.runHealthCheck(p.id)));
    return { checked: results.length, healthy: results.filter((r) => r.lastHealthCheckOk).length };
  }

  /** Reused by DashboardService for the integrations health widget. */
  async getOverview() {
    const [byStatus, byCategory] = await Promise.all([
      this.prisma.integrationProvider.groupBy({ by: ['status'], _count: true }),
      this.prisma.integrationProvider.groupBy({ by: ['category'], _count: true, where: { isActive: true } }),
    ]);
    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      activeByCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
    };
  }

  // ---- Internal helpers ----

  private async requireProvider(id: string) {
    const provider = await this.prisma.integrationProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Integration provider ${id} not found`);
    return provider;
  }

  /** Strips the encrypted credential blob from anything returned to a controller — it is write-only over the API. */
  private redact<T extends { encryptedCredentials: string | null }>(provider: T) {
    const { encryptedCredentials: _encryptedCredentials, ...rest } = provider;
    return { ...rest, hasCredentials: Boolean(_encryptedCredentials) };
  }
}
