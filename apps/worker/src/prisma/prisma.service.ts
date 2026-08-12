import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Mirrors apps/api/src/prisma/prisma.service.ts. The worker connects to
 * the exact same database via the exact same generated Prisma client
 * (single `prisma/schema.prisma` at the repo root) — it does not get its
 * own schema or its own migrations. This service only exists as a
 * separate file because apps/api and apps/worker are separate Nest
 * applications/processes and each needs its own DI-registered instance.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
