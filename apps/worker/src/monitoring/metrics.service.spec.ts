import { MetricsService } from './metrics.service';

/**
 * ADDENDUM (FC-6.1): constructs MetricsService with the explicit 'worker'
 * prefix throughout, matching MonitoringModule's own METRICS_PREFIX
 * binding for this app — the prefix is no longer hardcoded inside the
 * service itself (see its own doc comment), so a direct `new
 * MetricsService()` now defaults to 'app', not 'worker'.
 */
describe('MetricsService', () => {
  it('renders recorded HTTP requests and job outcomes as Prometheus text', () => {
    const metrics = new MetricsService('worker');

    metrics.recordHttpRequest('GET', '/health', 200, 12);
    metrics.recordJobOutcome('email', 'completed', 340);
    metrics.recordJobOutcome('email', 'failed', 9000);

    const text = metrics.toPrometheusText();

    expect(text).toContain('worker_http_requests_total{method="GET",route="/health",status="200"} 1');
    expect(text).toContain('worker_jobs_processed_total{queue="email",status="completed"} 1');
    expect(text).toContain('worker_jobs_processed_total{queue="email",status="failed"} 1');
    expect(text).toContain('worker_job_duration_ms_count 2');
    expect(text).toContain('worker_job_duration_ms_sum 9340');
  });

  it('starts with zeroed histogram/counter output when nothing has been recorded', () => {
    const metrics = new MetricsService('worker');
    const text = metrics.toPrometheusText();
    expect(text).toContain('worker_job_duration_ms_count 0');
  });

  it('defaults to an "app" prefix when constructed without one (e.g. outside Nest DI)', () => {
    const metrics = new MetricsService();
    const text = metrics.toPrometheusText();
    expect(text).toContain('app_job_duration_ms_count 0');
    expect(text).not.toContain('worker_');
  });
});
