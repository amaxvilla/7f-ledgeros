import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS } from '@7f/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { getJwtAccessSecret } from '../../common/config/jwt-secret';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        entityAccess: true,
        departmentAccess: true,
        costCenterAccess: true,
        projectAccess: true,
        businessUnitAccess: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    );

    // SYSTEM_ADMIN is defined structurally by possession of every
    // known permission, matching SecurityContextService.
    const isSystemAdmin =
      permissions.length >= Object.keys(PERMISSIONS).length;

    return {
      id: user.id,
      email: user.email,
      permissions,
      isSystemAdmin,
      entityAccess: user.entityAccess.map((ea) => ({
        entityId: ea.entityId,
        canPost: ea.canPost,
        canView: ea.canView,
      })),
      departmentAccess: user.departmentAccess.map((da) => ({
        departmentId: da.departmentId,
        canPost: da.canPost,
        canView: da.canView,
      })),
      costCenterAccess: user.costCenterAccess.map((ca) => ({
        costCenterId: ca.costCenterId,
        canPost: ca.canPost,
        canView: ca.canView,
      })),
      projectAccess: user.projectAccess.map((pa) => ({
        projectId: pa.projectId,
        canPost: pa.canPost,
        canView: pa.canView,
      })),
      businessUnitAccess: user.businessUnitAccess.map((ba) => ({
        businessUnitId: ba.businessUnitId,
        canPost: ba.canPost,
        canView: ba.canView,
      })),
    };
  }
}
