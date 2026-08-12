import { Injectable } from '@nestjs/common';
import { LoginEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Login History (Release K). A dedicated compliance record — distinct
 * from the global AuditLog (which only covers authenticated mutating
 * requests): this captures pre-auth events too, including failed
 * attempts against emails that match no user at all.
 */
@Injectable()
export class LoginHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    userId: string | null,
    emailAttempted: string,
    eventType: LoginEventType,
    context: LoginContext = {},
    failureReason?: string,
  ) {
    return this.prisma.loginHistory.create({
      data: {
        userId,
        emailAttempted,
        eventType,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        failureReason,
      },
    });
  }

  findForUser(userId: string, limit = 50) {
    return this.prisma.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  findRecent(filters: { emailAttempted?: string; eventType?: LoginEventType }, limit = 100) {
    return this.prisma.loginHistory.findMany({ where: filters, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
