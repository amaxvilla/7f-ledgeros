import { BadRequestException, Injectable } from '@nestjs/common';
import { IpRuleScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ipInCidr, isIPv4 } from './ip-cidr.util';

export interface CreateIpRuleInput {
  scope: IpRuleScope;
  userId?: string;
  cidr: string;
  label?: string;
}

/**
 * IP Restrictions (Release P). Fail-open-until-configured, fail-closed
 * once configured — same posture as RowLevelSecurityService: a caller
 * with zero applicable active rules is unrestricted; the moment at
 * least one GLOBAL or USER-scoped rule applies to them, their request
 * IP must match one of those rules. See the schema comment on
 * IpAllowlistRule for why ENTITY scope isn't included.
 */
@Injectable()
export class IpRestrictionService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(input: CreateIpRuleInput, createdById: string) {
    if (input.scope === IpRuleScope.USER && !input.userId) {
      throw new BadRequestException('userId is required for a USER-scoped rule');
    }
    if (input.scope === IpRuleScope.GLOBAL && input.userId) {
      throw new BadRequestException('userId must not be set for a GLOBAL-scoped rule');
    }
    const [rangeIp] = input.cidr.split('/');
    if (!isIPv4(rangeIp)) {
      throw new BadRequestException(`"${input.cidr}" is not a valid IPv4 CIDR — IPv6 is not supported yet`);
    }

    return this.prisma.ipAllowlistRule.create({
      data: {
        scope: input.scope,
        userId: input.scope === IpRuleScope.USER ? input.userId : null,
        cidr: input.cidr,
        label: input.label,
        createdById,
      },
    });
  }

  listRules(filters: { scope?: IpRuleScope; userId?: string } = {}) {
    const where: Prisma.IpAllowlistRuleWhereInput = {};
    if (filters.scope) where.scope = filters.scope;
    if (filters.userId) where.userId = filters.userId;
    return this.prisma.ipAllowlistRule.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async deactivateRule(id: string) {
    return this.prisma.ipAllowlistRule.update({ where: { id }, data: { isActive: false } });
  }

  /** Core check, used by both IpRestrictionGuard (every authenticated
   *  request) and AuthService.login() (before issuing a challenge/token). */
  async isIpAllowed(ipAddress: string | undefined, userId: string): Promise<boolean> {
    const rules = await this.prisma.ipAllowlistRule.findMany({
      where: {
        isActive: true,
        OR: [{ scope: IpRuleScope.GLOBAL }, { scope: IpRuleScope.USER, userId }],
      },
    });
    if (rules.length === 0) return true; // unrestricted — nothing configured

    if (!ipAddress) return false; // rules exist but we have no address to check — fail closed
    return rules.some((rule) => ipInCidr(ipAddress, rule.cidr));
  }
}
