import nodemailer from 'nodemailer';
import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';

/**
 * Release IC.1 — Email Integration (SMTP wiring).
 *
 * The second real driver registered into Release IA's
 * INTEGRATION_DRIVER_REGISTRY (AwsS3HealthCheckDriver was the first —
 * see apps/api/src/storage/providers/aws-s3-health-check.driver.ts,
 * which this mirrors exactly). Confirms the SMTP server is reachable and
 * will accept the stored credentials via nodemailer's own `verify()`
 * (an EHLO/AUTH handshake with no message sent) rather than actually
 * sending a test email.
 */
export class SmtpHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const host = params.config?.host as string | undefined;
    if (!host) {
      return { ok: false, message: 'Missing config.host' };
    }
    const port = Number(params.config?.port ?? 587);
    const secure = Boolean(params.config?.secure ?? false);
    const user = params.credentials?.user as string | undefined;
    const password = params.credentials?.password as string | undefined;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: password } : undefined,
    });

    try {
      await transporter.verify();
      return { ok: true, message: `SMTP server "${host}:${port}" accepted the connection` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    } finally {
      transporter.close();
    }
  }
}
