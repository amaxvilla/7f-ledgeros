import { Module } from '@nestjs/common';
import { CustomerPortalController } from './customer-portal.controller';
import { RealEstateModule } from '../real-estate/real-estate.module';
import { HandoverModule } from '../handover/handover.module';

/**
 * Real Estate — Customer Portal (additive). Composes two existing
 * modules' already-exported services (RealEstateService, HandoverService)
 * behind one new customer-facing controller — no new providers, no
 * duplicated business logic, matching this codebase's own "DashboardModule
 * composes many domain modules' exported services" precedent.
 */
@Module({
  imports: [RealEstateModule, HandoverModule],
  controllers: [CustomerPortalController],
})
export class CustomerPortalModule {}
