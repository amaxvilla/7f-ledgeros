import pino, { type Logger as PinoLogger } from 'pino';

export interface CreateLoggerOptions {
  /** e.g. "api" or "worker" — tags every log line so aggregated logs can be filtered by process. */
  service: string;
  level?: string;
  pretty?: boolean;
}

/**
 * Single source of truth for how every process (api, worker) constructs its
 * logger: JSON lines in production (for ingestion by a log aggregator),
 * pretty-printed in development. Redacts common secret-shaped fields so
 * request/job payloads can be logged without manually scrubbing them.
 */
export function createLogger(options: CreateLoggerOptions): PinoLogger {
  const { service, level = process.env.LOG_LEVEL ?? 'info', pretty = process.env.LOG_PRETTY !== 'false' } = options;

  return pino({
    level,
    base: { service },
    redact: {
      paths: [
        'password',
        'passwordHash',
        '*.password',
        '*.passwordHash',
        'authorization',
        'req.headers.authorization',
        'token',
        'accessToken',
        'refreshToken',
        'smtpPassword',
      ],
      censor: '[REDACTED]',
    },
    transport:
      pretty && process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
        : undefined,
  });
}

/**
 * Adapts a pino logger to Nest's LoggerService interface so it can be
 * passed to `NestFactory.create(AppModule, { logger })`. Keeps Nest's own
 * framework log lines (route mapping, module init, etc.) flowing through
 * the same structured/redacted pipeline as application logs, instead of a
 * separate unstructured console logger.
 */
export interface NestCompatibleLogger {
  log(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  debug?(message: unknown, ...optionalParams: unknown[]): void;
  verbose?(message: unknown, ...optionalParams: unknown[]): void;
}

export function toNestLogger(logger: PinoLogger): NestCompatibleLogger {
  return {
    log: (message, ...rest) => logger.info({ context: rest[rest.length - 1] }, String(message)),
    error: (message, ...rest) => logger.error({ trace: rest[0], context: rest[1] }, String(message)),
    warn: (message, ...rest) => logger.warn({ context: rest[rest.length - 1] }, String(message)),
    debug: (message, ...rest) => logger.debug({ context: rest[rest.length - 1] }, String(message)),
    verbose: (message, ...rest) => logger.trace({ context: rest[rest.length - 1] }, String(message)),
  };
}

export type { PinoLogger };
