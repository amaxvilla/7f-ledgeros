import { MetricsService } from './metrics.service';

/**
 * ADDENDUM (FC-6.1): this file did not exist before this checkpoint — the
 * API's own copy of MetricsService had zero test coverage, even though the
 * worker's identical copy did (see the worker's own metrics.service.spec.ts).
 * Constructs with the explicit 'api' prefix throughout, matching
 * MonitoringModule's own METRICS_PREFIX binding for this app.
 *
 * The second test below is the direct regression test for the bug this
 * checkpoint fixed: `recordHttpRequest` has always fed an `httpDuration`
 * histogram, but `toPrometheusText()` never emitted it — only
 * `job_duration_ms` was written out. Since the API process only ever calls
 * `recordHttpRequest` (no queue listener calling `recordJobOutcome` the way
 * the worker has), this meant the API's own /metrics endpoint exposed zero
 * histogram data of any kind before this fix.
 */
describe('MetricsService (api)', () => {
  it('renders recorded HTTP requests with the api_ prefix, not worker_', () => {
    const metrics = new MetricsService('api');

    metrics.recordHttpRequest('GET', '/health', 200, 12);
    metrics.recordHttpRequest('POST', '/journal-entries', 201, 45);

    const text = metrics.toPrometheusText();

    expect(text).toContain('api_http_requests_total{method="GET",route="/health",status="200"} 1');
    expect(text).toContain('api_http_requests_total{method="POST",route="/journal-entries",status="201"} 1');
    expect(text).not.toContain('worker_');
  });

  it('emits the http_request_duration_ms histogram — the metric this process actually produces, previously missing entirely', () => {
    const metrics = new MetricsService('api');

    metrics.recordHttpRequest('GET', '/health', 200, 12);
    metrics.recordHttpRequest('GET', '/health', 200, 88);

    const text = metrics.toPrometheusText();

    expect(text).toContain('# TYPE api_http_request_duration_ms histogram');
    expect(text).toContain('api_http_request_duration_ms_count 2');
    expect(text).toContain('api_http_request_duration_ms_sum 100');
    // A 12ms and an 88ms observation both fall at/under the 100ms bucket.
    expect(text).toContain('api_http_request_duration_ms_bucket{le="100"} 2');
  });

  it('still emits job_duration_ms (zeroed) even though the API process never calls recordJobOutcome', () => {
    const metrics = new MetricsService('api');
    const text = metrics.toPrometheusText();
    expect(text).toContain('api_job_duration_ms_count 0');
  });

  it('defaults to an "app" prefix when constructed without one (e.g. outside Nest DI)', () => {
    const metrics = new MetricsService();
    const text = metrics.toPrometheusText();
    expect(text).toContain('app_http_request_duration_ms_count 0');
  });
});
