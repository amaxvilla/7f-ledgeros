import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadSystemConfig } from '@7f/config';
import { createLogger, toNestLogger } from '@7f/logger';
import { AppModule } from './app.module';
import { mountQueueDashboard } from './queue-dashboard/bull-board';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';

async function bootstrap() {
  // Fail fast on missing/invalid env config rather than failing confusingly
  // partway through processing the first job.
  const config = loadSystemConfig();

  const logger = createLogger({ service: 'worker', level: config.LOG_LEVEL, pretty: config.LOG_PRETTY });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: toNestLogger(logger),
  });

  app.enableShutdownHooks();

  // Idempotent — safe to run on every boot.
  await app.get(FeatureFlagsService).ensureDefaults();

  mountQueueDashboard(app.getHttpAdapter().getInstance());

  const port = config.WORKER_HTTP_PORT;
  await app.listen(port);

  logger.info(
    { port, dashboardEnabled: config.QUEUE_DASHBOARD_ENABLED },
    `7F LedgerOS worker listening on :${port} (health: /health /ready /live, metrics: /metrics, queue dashboard: /admin/queues)`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start:', err);
  process.exit(1);
});
