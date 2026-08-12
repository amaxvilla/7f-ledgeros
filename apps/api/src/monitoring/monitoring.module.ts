import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsService, METRICS_PREFIX } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { PerformanceMiddleware } from './performance.middleware';

@Module({
  controllers: [MetricsController],
  // FC-6.1: binds this process's own metric-name prefix — see
  // MetricsService's own doc comment for why this is now injected rather
  // than hardcoded (previously every /metrics endpoint in the app emitted
  // worker_-prefixed names, api included).
  providers: [{ provide: METRICS_PREFIX, useValue: 'api' }, MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PerformanceMiddleware).forRoutes('*');
  }
}
