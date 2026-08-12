import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { getJwtAccessSecret } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Background jobs need to run the SAME business logic the API already
 * implements (payroll calculation, bank statement import, budget variance,
 * dashboard/report queries) rather than a second, drifting copy of it.
 * Re-importing NestJS modules from apps/api directly into apps/worker
 * would couple two independently-deployed processes at the source level;
 * calling back over HTTP with a scoped service-account token keeps them
 * decoupled while still hitting the one real implementation.
 *
 * The token is signed locally (not obtained via a login call) because the
 * worker already knows JWT_ACCESS_SECRET — the same secret apps/api uses
 * to verify tokens (see @7f/config's jwt.ts). This avoids a network round
 * trip and a stored password for a service account that never logs in
 * through the normal auth flow.
 */
@Injectable()
export class InternalApiClient {
  private readonly logger = new Logger(InternalApiClient.name);
  private readonly http: AxiosInstance;
  private cachedToken: { value: string; expiresAt: number } | null = null;
  private serviceUserId: string | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.http = axios.create({
      baseURL: process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:4000/api/v1',
      timeout: 30_000,
    });
  }

  private async getServiceUserId(): Promise<string> {
    if (this.serviceUserId) return this.serviceUserId;

    const email = process.env.WORKER_SERVICE_USER_EMAIL ?? 'worker-service@7fifteencapital.com';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new InternalServerErrorException(
        `Worker service account (${email}) not found. Run: pnpm db:seed:service-account`,
      );
    }
    if (!user.isActive) {
      throw new InternalServerErrorException(`Worker service account (${email}) is deactivated.`);
    }
    this.serviceUserId = user.id;
    return user.id;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 30_000) {
      return this.cachedToken.value;
    }

    const [sub, email] = await Promise.all([
      this.getServiceUserId(),
      Promise.resolve(process.env.WORKER_SERVICE_USER_EMAIL ?? 'worker-service@7fifteencapital.com'),
    ]);

    const expiresInSeconds = 10 * 60; // short-lived; re-signed well before expiry via the cache check above
    const token = jwt.sign({ sub, email }, getJwtAccessSecret(), { expiresIn: expiresInSeconds });
    this.cachedToken = { value: token, expiresAt: now + expiresInSeconds * 1000 };
    return token;
  }

  private async authHeader(): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${await this.getToken()}` };
  }

  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const headers = await this.authHeader();
    try {
      const response = await this.http.get<T>(path, { headers, params });
      return response.data;
    } catch (err) {
      this.logger.warn(`Internal GET ${path} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const headers = await this.authHeader();
    try {
      const response = await this.http.post<T>(path, body, { headers });
      return response.data;
    } catch (err) {
      this.logger.warn(`Internal POST ${path} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
