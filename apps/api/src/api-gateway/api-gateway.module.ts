import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyGuard } from './api-key.guard';
import { ApiScopeGuard } from './api-scope.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ApiScopeGuard,
    RateLimitService,
    RateLimitGuard,
  ],
  exports: [
    ApiKeyService,
    ApiKeyGuard,
    ApiScopeGuard,
    RateLimitService,
    RateLimitGuard,
  ],
})
export class ApiGatewayModule {}
