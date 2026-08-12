# Operational Runbooks

Stage FC-5 (Documentation). This guide is day-2 operations — what to do
once the system is already deployed and running, building on
[`deployment-guide.md`](./deployment-guide.md)'s own setup checklist.
Where that guide covers *how to configure* health checks and backups
correctly before going live, this one covers *what to actually do* with
them day to day: how to read a degraded health check, how to run a
backup or restore drill, how to reach the queue dashboard and metrics,
and what a few concrete incident scenarios look like in practice. Every
command, endpoint, and metric name below is confirmed directly against
this repository's own scripts and controllers, not written from a
generic sense of what an ERP's ops runbook usually contains.

## Health checks, day-to-day

Both `api` and `worker` expose the same three endpoints
(`/live`/`/ready`/`/health` — see `deployment-guide.md` for what each
means at a protocol level). Operationally:

- **A `/live` failure** means the process itself is wedged or down —
  restart the container. It never checks Postgres/Redis, so a `/live`
  failure is never a database or Redis problem; don't spend time
  checking those first.
- **A `/ready` failure (`503`) or `/health` showing `"degraded"`** means
  the process is up but can't reach Postgres or Redis (or both) — check
  the `checks: { database, redis }` body first to know which one, then
  check that dependency directly (`docker compose ps postgres redis`,
  `docker compose logs postgres`/`redis`) before assuming an
  application-level bug.
- The **worker's own `/health`** additionally reports
  `samplePayrollQueueDepth` — the current waiting-job count for one
  specific queue (`payroll-processing`, confirmed directly against
  `HealthController`'s own `@InjectQueue` call), sampled as a rough
  worker-is-actually-processing-jobs signal, not a general queue-depth
  metric across every queue. For real per-queue depth, use the queue
  dashboard (below) or the Prometheus job-count metrics.

## Backups

The `backup` compose service runs `scripts/backup.sh` on a loop
(`BACKUP_INTERVAL_SECONDS`, default daily) — confirmed directly by
reading the script, not assumed from its name alone:

- Each run: `pg_dump --no-owner --format=plain | gzip` to
  `${BACKUP_DIR}/ledgeros-<UTC-timestamp>.sql.gz`, written to a
  `.in-progress` temp file first and only renamed to its final name on
  success — a partial/failed dump never gets picked up by anything
  looking for a real backup file, since it never exists under its final
  name.
- If `BACKUP_S3_BUCKET` is set AND the `aws` CLI is present in the
  container, the same file is also uploaded to
  `s3://${BACKUP_S3_BUCKET}/<same-filename>` — if the CLI isn't
  installed, the script logs that plainly and skips the upload rather
  than failing the whole backup run.
- Old backups are pruned locally on every run:
  `find "$BACKUP_DIR" -name 'ledgeros-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete`
  (default 30 days) — this prunes the local `BACKUP_DIR` only; it does
  not touch anything already uploaded to S3.
- **A failed `pg_dump` does not stop the loop** — the script logs
  `[backup] backup run failed — will retry next interval` and waits for
  the next scheduled run. This means a silently-broken backup (e.g.
  Postgres credentials rotated without updating the `backup` service's
  own env) can persist for a long time without anything visibly down —
  worth an explicit periodic check (see "Verify a backup is actually
  recent," below) rather than assuming "the container is running" means
  "backups are happening."
- Can also be invoked directly by host cron instead of/alongside the
  compose service, per the script's own header comment:
  ```
  0 2 * * * PGHOST=localhost PGUSER=ledgeros PGPASSWORD=... PGDATABASE=ledgeros \
    BACKUP_DIR=/var/backups/ledgeros /path/to/scripts/backup.sh --once
  ```

### Verify a backup is actually recent

```
docker compose exec backup sh -c 'ls -lt "$BACKUP_DIR"/ledgeros-*.sql.gz | head -5'
```
If the newest file's timestamp is older than `BACKUP_INTERVAL_SECONDS`
plus a reasonable margin, something is wrong — check
`docker compose logs backup` for the `[backup] pg_dump FAILED` line.

### Restore

`scripts/restore.sh` — confirmed directly, this is genuinely destructive
by design, not a safety-railed wrapper:

```
PGHOST=localhost PGUSER=ledgeros PGPASSWORD=... PGDATABASE=ledgeros \
  ./scripts/restore.sh /backups/ledgeros-20260726T020000Z.sql.gz
```

It prints a warning, sleeps 5 seconds (the only pause before it acts —
Ctrl+C within that window is the only abort mechanism), then pipes the
decompressed dump straight into `psql --set ON_ERROR_STOP=on` against
`PGDATABASE` **as configured** — it does not create a new database, and
it does not ask again. The script's own header comment states the
correct real-world procedure plainly: for an actual disaster-recovery
situation, restore into a freshly created database first
(`createdb ledgeros_restore_test`, then run the same command with
`PGDATABASE=ledgeros_restore_test`) and verify the data looks right
before ever pointing `PGDATABASE` at production and re-running.

**Restore drill, recommended periodically, not just when something has
already gone wrong**: pick the most recent backup file, restore it into
a scratch database as above, spot-check row counts on a few
high-traffic tables, then drop the scratch database. This is the only
way to know the backup/restore pair actually works end-to-end — a
backup file existing on disk is not proof it's restorable.

## Queue dashboard

`bull-board`, mounted at `/admin/queues` on the **worker's** own HTTP
port (`WORKER_HTTP_PORT`, default `4100`) — confirmed directly against
`mountQueueDashboard`, not the API.

- **Disabled entirely unless `QUEUE_DASHBOARD_PASSWORD` is set** — this
  is a deliberate default, not a bug: the dashboard exposes job
  payloads (which can include PII/financial data, per the code's own
  comment) and lets an authenticated caller retry or remove jobs, so an
  open-by-default dashboard was judged the wrong default. Set
  `QUEUE_DASHBOARD_PASSWORD` (and optionally `QUEUE_DASHBOARD_USER`,
  default `admin`) to turn it on.
- Auth is plain HTTP Basic auth, checked by a small Express middleware
  in front of bull-board's own router — **not** wired through this
  app's own Nest permission/guard system (`RequirePermissions`, etc.),
  since bull-board owns its own router past the mount point. This means
  dashboard access is an all-or-nothing shared credential, not scoped
  per-user the way every other admin surface in this app is — worth
  knowing when deciding who gets the password, since there's no way to
  give one operator read-only access and another full retry/remove
  access.
- Covers every queue in `ALL_QUEUE_NAMES` (`@7f/queue`) — a superset of
  the one queue (`payroll-processing`) the worker's own `/health`
  endpoint samples a depth for.

## Metrics

Both `api` and `worker` expose Prometheus-format text at `GET /metrics`
(`api` on its own port, `worker` on `WORKER_HTTP_PORT`) — confirmed
directly, both unauthenticated (`@Public()` on the API side; no auth
gate at all on the worker side), so treat network-level access to this
port as the actual access control, the same as any other unauthenticated
metrics endpoint.

**Fixed since this guide was first written (FC-6.1) — corrected here so
this section stops describing a bug that no longer exists**:
`apps/api/src/monitoring/metrics.service.ts` and
`apps/worker/src/monitoring/metrics.service.ts` are still byte-identical
files (confirmed directly with `diff` — zero output), but the metric
*prefix* is no longer hardcoded inside that shared file — each process's
own `MonitoringModule` now injects it via a `METRICS_PREFIX` token
(`'api'` for the API, `'worker'` for the worker; confirmed directly in
both `monitoring.module.ts` files). The API's own HTTP-request metrics
are now genuinely `api_`-prefixed
(`api_http_requests_total{method,route,status}`,
`api_http_request_duration_ms`), distinct from the worker's
`worker_jobs_processed_total{queue,status}` and `worker_job_duration_ms`
— confirmed directly against `metrics.service.spec.ts`'s own test names
(`"renders recorded HTTP requests with the api_ prefix, not worker_"`).
If you built a dashboard or alert rule against the old
`worker_http_requests_total` name for API traffic before this fix
shipped, it now needs updating to `api_http_requests_total` — that rule
will otherwise silently stop matching rather than error.

Both processes also emit a histogram alongside their counters —
`{prefix}_http_request_duration_ms` (request latency) and
`{prefix}_job_duration_ms` (background job duration), each with the
standard `_bucket`/`_sum`/`_count` series — confirmed directly in
`toPrometheusText()`. The API previously emitted no histogram data at
all (only the worker's `job_duration_ms` was ever written out); that gap
closed in the same FC-6.1 pass.

## Logging

Both processes log structured JSON lines via a single shared
`createLogger()` (`@7f/logger`) — pretty-printed instead when
`NODE_ENV !== 'production'` and `LOG_PRETTY` isn't explicitly `false`,
so production log aggregation always gets JSON regardless of local dev
preferences. Every log line is tagged `service: "api"` or
`service: "worker"` (the `service` option each process passes in) — the
one reliable field to filter by if the metrics-naming quirk above ever
makes you reach for logs to disambiguate instead.

`LOG_LEVEL` controls verbosity (default `info`). The logger redacts a
fixed set of field-name patterns automatically before anything is
written — `password`, `passwordHash`, `authorization`,
`req.headers.authorization`, `token`, `accessToken`, `refreshToken`,
`smtpPassword` (and the same set one level nested, e.g. `*.password`) —
confirmed directly from the redact-paths list. This is real, working
redaction for those specific field names, not a general secret-scrubbing
heuristic — a differently-named sensitive field (e.g. a provider API key
logged under some other key name) would NOT be caught by this list.
Don't rely on it as a blanket guarantee that nothing sensitive ever
reaches logs; it covers the specific fields it lists and nothing else.

## Common incident scenarios

**Worker queue backing up (jobs piling up, not processing)**
1. Check `/health` on the worker — `samplePayrollQueueDepth` climbing
   suggests jobs aren't draining; `dbOk`/`redisOk` both `true` rules out
   the two dependency failures that would otherwise explain it.
2. Check the queue dashboard (`/admin/queues`) for the specific queue(s)
   backing up and whether jobs are failing repeatedly (visible directly
   in bull-board's own per-job view) vs. simply arriving faster than
   they're processed.
3. Check `worker_jobs_processed_total{queue="...",status="failed"}` in
   `/metrics` for a spike, and worker logs (`service: "worker"`) for the
   actual error — the dashboard shows job-level failure, logs show why.

**Backup silently stopped working**
Covered above under "Verify a backup is actually recent" — this is the
one failure mode in this system that produces no alert on its own (the
`backup` container keeps running and retrying even while every run
fails), so it needs an explicit periodic check rather than
assume-healthy-if-the-container-is-up.

**API/worker reports `"degraded"` but the app still seems to work**
`/health` can report `degraded` from a transient Postgres/Redis blip
that resolves before anyone else notices — check whether `/ready` is
still failing (persistent) or has already recovered (transient) before
escalating; `/health`'s own `200` status code means "check the body," not
"nothing is wrong."

## What this guide does not cover

Release Notes (a separate, still-open FC-5 deliverable) and any
runbook for infrastructure that doesn't exist in this repository yet
(Kubernetes, a managed queue service, multi-region failover) — same
"nothing to document, don't invent it" reasoning `deployment-guide.md`'s
own "what this guide does not cover" section already gives for
orchestration beyond `docker-compose.yml`.
