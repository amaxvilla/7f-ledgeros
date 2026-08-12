import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` inside a database transaction with sensible defaults for
   * posting-critical operations (higher timeout, serializable-adjacent
   * isolation via Prisma's default READ COMMITTED + explicit row locking
   * in the posting engine itself).
   */
  async runInTransaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn, {
      maxWait: 10_000,
      timeout: 20_000,
    });
  }
}
