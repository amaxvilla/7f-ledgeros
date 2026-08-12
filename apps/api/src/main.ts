import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { createLogger, toNestLogger } from '@7f/logger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { FieldMaskingInterceptor } from './security/field-masking.interceptor';

/**
 * CORS defaults to permissive (reflect any origin) outside production, which
 * matches local dev where the web app's origin is unpredictable. In
 * production, an unrestricted CORS policy on an API serving financial data
 * is a real risk, so CORS_ORIGINS (comma-separated allow-list) is required —
 * the app fails fast on boot rather than falling back to allow-all.
 */
function getCorsOptions(): boolean | { origin: string[] } {
  const raw = process.env.CORS_ORIGINS;
  if (raw && raw.trim().length > 0) {
    return { origin: raw.split(',').map((o) => o.trim()).filter(Boolean) };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGINS is not set. Refusing to start in production with an unrestricted CORS policy.',
    );
  }
  return true;
}

async function bootstrap() {
  const logger = createLogger({ service: 'api' });
  // rawBody: true — Release ID.2 Part 2 (WhatsApp Cloud API webhook).
  // Meta signs the exact raw bytes of the webhook request body
  // (X-Hub-Signature-256); re-serializing the parsed JSON body would not
  // reliably reproduce those bytes. This exposes `request.rawBody` as a
  // Buffer alongside Nest's normal body parsing for every route — purely
  // additive, no existing route reads or depends on it.
  const app = await NestFactory.create(AppModule, { cors: getCorsOptions(), logger: toNestLogger(logger), rawBody: true });

  app.use(helmet());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'live', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(app.get(AuditInterceptor), app.get(FieldMaskingInterceptor));

  // Swagger is on by default outside production. In production it stays off
  // unless explicitly opted into via SWAGGER_ENABLED=true, since it exposes
  // the full API surface (routes, DTOs, auth scheme) to anyone who can reach it.
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== 'false');

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('7F LedgerOS API')
      .setDescription(
        'Multi-entity financial operating system for 7Fifteen Capital Ltd — GL, dimensions, intercompany, consolidation, real estate, PMO, treasury, HR, HSE.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'apiKey')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;
  await app.listen(port, process.env.API_HOST ?? '0.0.0.0');
  logger.info({ port }, `7F LedgerOS API listening on port ${port} — docs at /api/docs`);
}

bootstrap();
