import { Module } from '@nestjs/common';
import { PartnerApiController } from './partner-api.controller';
import { PartnerApiVersionController } from './partner-api-version.controller';
import { ApiGatewayModule } from '../api-gateway/api-gateway.module';
import { TransfersModule } from '../transfers/transfers.module';
import { PaymentsModule } from '../payments/payments.module';

/**
 * API Gateway, Checkpoint C — the first real partner-facing module.
 * Imports ApiGatewayModule for ApiKeyGuard/RateLimitGuard/ApiScopeGuard
 * (all three were already exported, just unused by any route until
 * now) and TransfersModule for BankTransferService — no new provider
 * registered here, this module is purely a controller wired to
 * existing services through the new auth path.
 *
 * Checkpoint D adds PaymentsModule for PaymentsService (payment/refund
 * status routes) — same "no new provider, just another existing
 * service's module imported" pattern.
 *
 * Checkpoint E adds PartnerApiVersionController — no new imports
 * needed, it has no service dependencies at all. See that controller's
 * own doc comment for why it's a second controller rather than another
 * route on PartnerApiController.
 */
@Module({
  imports: [ApiGatewayModule, TransfersModule, PaymentsModule],
  controllers: [PartnerApiController, PartnerApiVersionController],
})
export class PartnerApiModule {}
