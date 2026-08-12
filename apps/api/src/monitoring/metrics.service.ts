import { Inject, Injectable, Optional } from '@nestjs/common';

export const METRICS_PREFIX = 'METRICS_PREFIX';

interface Histogram {
  count: number;
  sum: number;
  buckets: Map<number, number>; // upper bound -> cumulative count
}

const DEFAULT_BUCKETS_MS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

/**
 * Deliberately dependency-free (no prom-client) — a handful of counters and
 * one histogram shape is all this process needs, and hand-rolling it avoids
 * pulling in a client library whose default registry/collectors we'd have
 * to reason about. Exposed at /metrics in the standard Prometheus text
 * exposition format so it drops into any existing Prometheus/Grafana setup.
 *
 * ADDENDUM (FC-6.1, Production Hardening — Metrics): this file is
 * deliberately identical between apps/api and apps/worker (see
 * MonitoringModule in each app for the only difference: which value they
 * bind to METRICS_PREFIX). It used to hardcode a literal `worker_` prefix
 * on every metric name, which was harmless for the worker process but meant
 * the API's own /metrics endpoint emitted worker_-prefixed names for its
 * own HTTP traffic — no api_*-prefixed metric existed anywhere (found
 * FC-5.7, documented as a known gap in docs/operational-runbooks.md). The
 * prefix is now injected via the METRICS_PREFIX token instead, defaulting
 * to 'app' for any caller (e.g. a unit test) that constructs this service
 * directly without going through Nest's DI container.
 *
 * A second, related gap closed in the same pass: `recordHttpRequest` has
 * always fed an `httpDuration` histogram, but `toPrometheusText()` never
 * actually emitted it — only `jobDuration` was written out. Since the API
 * process only ever calls `recordHttpRequest` (it has no queue listener
 * calling `recordJobOutcome` the way the worker does), this meant the
 * API's own /metrics endpoint exposed zero histogram data of any kind.
 * `http_request_duration_ms` is now emitted alongside `job_duration_ms`.
 */
@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal = new Map<string, number>();
  private readonly httpDuration: Histogram = { count: 0, sum: 0, buckets: new Map(DEFAULT_BUCKETS_MS.map((b) => [b, 0])) };

  private readonly jobsProcessedTotal = new Map<string, number>(); // key: `${queue}:${status}`
  private readonly jobDuration: Histogram = { count: 0, sum: 0, buckets: new Map(DEFAULT_BUCKETS_MS.map((b) => [b, 0])) };

  constructor(@Optional() @Inject(METRICS_PREFIX) private readonly prefix: string = 'app') {}

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number) {
    const key = `${method}|${route}|${statusCode}`;
    this.httpRequestsTotal.set(key, (this.httpRequestsTotal.get(key) ?? 0) + 1);
    this.observe(this.httpDuration, durationMs);
  }

  recordJobOutcome(queueName: string, status: 'completed' | 'failed', durationMs: number) {
    const key = `${queueName}:${status}`;
    this.jobsProcessedTotal.set(key, (this.jobsProcessedTotal.get(key) ?? 0) + 1);
    this.observe(this.jobDuration, durationMs);
  }

  private observe(hist: Histogram, valueMs: number) {
    hist.count += 1;
    hist.sum += valueMs;
    for (const bucket of hist.buckets.keys()) {
      if (valueMs <= bucket) {
        hist.buckets.set(bucket, (hist.buckets.get(bucket) ?? 0) + 1);
      }
    }
  }

  private renderHistogram(lines: string[], name: string, help: string, hist: Histogram) {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const [bucket, count] of hist.buckets) {
      lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${hist.count}`);
    lines.push(`${name}_sum ${hist.sum}`);
    lines.push(`${name}_count ${hist.count}`);
  }

  toPrometheusText(): string {
    const p = this.prefix;
    const lines: string[] = [];

    lines.push(`# HELP ${p}_http_requests_total Total HTTP requests handled by this process`);
    lines.push(`# TYPE ${p}_http_requests_total counter`);
    for (const [key, value] of this.httpRequestsTotal) {
      const [method, route, statusCode] = key.split('|');
      lines.push(`${p}_http_requests_total{method="${method}",route="${route}",status="${statusCode}"} ${value}`);
    }

    this.renderHistogram(lines, `${p}_http_request_duration_ms`, 'HTTP request duration in milliseconds', this.httpDuration);

    lines.push(`# HELP ${p}_jobs_processed_total Background jobs processed, by queue and outcome`);
    lines.push(`# TYPE ${p}_jobs_processed_total counter`);
    for (const [key, value] of this.jobsProcessedTotal) {
      const [queueName, status] = key.split(':');
      lines.push(`${p}_jobs_processed_total{queue="${queueName}",status="${status}"} ${value}`);
    }

    this.renderHistogram(lines, `${p}_job_duration_ms`, 'Job processing duration in milliseconds', this.jobDuration);

    return lines.join('\n') + '\n';
  }
}
