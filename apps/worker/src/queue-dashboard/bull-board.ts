import type { Express, Request, Response, NextFunction } from 'express';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ALL_QUEUE_NAMES, createRedisConnection } from '@7f/queue';

const DASHBOARD_PATH = '/admin/queues';

/**
 * Basic auth gate for the dashboard. Not wired through Nest's guard system
 * because bull-board owns its own express router past this mount point —
 * simplest correct thing is a plain express middleware in front of it.
 * If QUEUE_DASHBOARD_PASSWORD is unset, the dashboard is disabled entirely
 * rather than left open, since it exposes job payloads (which can include
 * PII/financial data) and lets an authenticated caller retry/remove jobs.
 */
function basicAuth(req: Request, res: Response, next: NextFunction) {
  const expectedUser = process.env.QUEUE_DASHBOARD_USER ?? 'admin';
  const expectedPassword = process.env.QUEUE_DASHBOARD_PASSWORD;

  if (!expectedPassword) {
    res.status(503).send('Queue dashboard disabled: set QUEUE_DASHBOARD_PASSWORD to enable it.');
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="7F LedgerOS Queue Dashboard"');
    res.status(401).send('Authentication required');
    return;
  }

  const [user, password] = Buffer.from(header.slice(6), 'base64').toString('utf-8').split(':');
  if (user !== expectedUser || password !== expectedPassword) {
    res.set('WWW-Authenticate', 'Basic realm="7F LedgerOS Queue Dashboard"');
    res.status(401).send('Invalid credentials');
    return;
  }

  next();
}

export function mountQueueDashboard(app: Express): void {
  if (process.env.QUEUE_DASHBOARD_ENABLED === 'false') return;

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const queues = ALL_QUEUE_NAMES.map((name) => new Queue(name, { connection: createRedisConnection(redisUrl) }));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(DASHBOARD_PATH);

  createBullBoard({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above: bull-board@5.23's
    // published types predate bullmq's newer JobProgress union; functionally compatible.
    queues: queues.map((q) => new BullMQAdapter(q)) as any,
    serverAdapter,
  });

  app.use(DASHBOARD_PATH, basicAuth, serverAdapter.getRouter());
}
