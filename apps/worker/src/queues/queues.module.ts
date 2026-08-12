import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@7f/queue';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          // BullMQ manages its own ioredis instance per queue/worker when given
          // connection options directly (rather than a shared client instance),
          // which is the pattern @nestjs/bullmq expects.
          host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname,
          port: Number(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || 6379),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      ...Object.values(QUEUE_NAMES).map((name) => ({ name })),
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
