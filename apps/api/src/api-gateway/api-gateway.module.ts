import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyGuard } from './api-key.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * API Gateway, Checkpoint A — API Keys. Model + service + admin CRUD
 * controller + guard class, all present, but ApiKeyGuard is exported
 * only — not applied as a global guard, not applied to any route yet.
 * See ApiKeyGuard's own doc comment for why that's later checkpoints'
 * decision (which routes, which scopes) rather than this one's.
 *
 * API Gateway, Checkpoint B — Rate Limiting. RateLimitService/
 * RateLimitGuard, same "written and exported, not yet wired to any
 * route" deferral as ApiKeyGuard above — see RateLimitGuard's own doc
 * comment for its ordering requirement relative to ApiKeyGuard once a
 * later checkpoint does wire both onto a real route.
 */
@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyGuard, RateLimitService, RateLimitGuard],
  exports: [ApiKeyService, ApiKeyGuard, RateLimitService, RateLimitGuard],
})
export class ApiGatewayModule {}
