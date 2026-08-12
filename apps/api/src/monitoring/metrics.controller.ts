import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus-format metrics scrape endpoint', description: 'Plain-text exposition format, not JSON -- intended for a Prometheus scraper, not a human caller via this Swagger UI. No auth: same class of infrastructure endpoint as a health check.' })
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics() {
    return this.metrics.toPrometheusText();
  }
}
