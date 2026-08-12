import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealEstateService } from '../real-estate/real-estate.service';
import { HandoverService } from '../handover/handover.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Real Estate — Customer Portal (additive, RE roadmap "Other Business
 * Gap Discovery" item, genuinely NOT FOUND before this checkpoint —
 * confirmed directly: no customer-facing controller existed anywhere in
 * the repository, only internal `RealEstateController`/
 * `HandoverController` routes gated behind `realestate.view`/
 * `handover.view`-style internal permissions).
 *
 * Follows `CandidatePortalController`'s own established shape exactly:
 * customers are not internal Users, so these routes are gated behind a
 * dedicated `customer.portal` permission rather than the internal
 * `realestate.*`/`handover.*` permission set. Wiring the actual external
 * auth mechanism that grants that permission (e.g. a passwordless
 * customer login) is out of scope here, same as that controller's own
 * doc comment states for candidates — this only exposes the read-only
 * APIs it will call.
 *
 * Phase 1 scope, deliberately narrow: statement (balances/schedule,
 * already fully computed by `RealEstateService.getCustomerStatement` —
 * no new query needed) and handover/snag status. Online payment
 * submission, document downloads, and maintenance-request intake are
 * real, separate future phases, not bundled into this checkpoint.
 */
@ApiTags('real-estate-customer-portal')
@ApiBearerAuth()
@Controller('customer-portal')
@RequirePermissions('customer.portal')
export class CustomerPortalController {
  constructor(
    private readonly realEstate: RealEstateService,
    private readonly handover: HandoverService,
  ) {}

  @Get('customers/:customerId/statement')
  @ApiOperation({
    summary: "Get the caller's own statement across every unit allocation",
    description:
      'Pure delegation to RealEstateService.getCustomerStatement (the same method the internal realestate.view route already uses) — for each allocation: unit, sale price, status, and outstanding balance (total due minus total paid across its installment lines, each installment line included), plus a grand total outstanding across all of them.',
  })
  getStatement(@Param('customerId') customerId: string) {
    return this.realEstate.getCustomerStatement(customerId);
  }

  @Get('customers/:customerId/handovers')
  @ApiOperation({
    summary: "List the caller's own handover records",
    description:
      'Every handover record for this customer, newest scheduled-date first, each including its own unit and snag items (newest first) — lets a customer track handover/inspection/snag-resolution progress on their own unit(s) without a staff member in the loop.',
  })
  getHandovers(@Param('customerId') customerId: string) {
    return this.handover.findRecordsForCustomer(customerId);
  }
}
