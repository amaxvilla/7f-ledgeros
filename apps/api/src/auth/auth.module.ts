import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { getJwtAccessSecret } from '../common/config/jwt-secret';
import { SecurityHardeningModule } from '../security-hardening/security-hardening.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtAccessSecret(),
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' },
    }),
    SecurityHardeningModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
