import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsService, METRICS_PREFIX } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { QueueMetricsListener } from './queue-metrics.listener';
import { PerformanceMiddleware } from './performance.middleware';

@Module({
  controllers: [MetricsController],
  // FC-6.1: binds this process's own metric-name prefix — see
  // MetricsService's own doc comment. This preserves the pre-existing
  // worker_-prefixed metric names exactly (no behavior change for the
  // worker process itself); only the API side of this bug is fixed.
  providers: [{ provide: METRICS_PREFIX, useValue: 'worker' }, MetricsService, QueueMetricsListener],
  exports: [MetricsService],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PerformanceMiddleware).forRoutes('*');
  }
}
