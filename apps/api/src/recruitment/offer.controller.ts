import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OfferService } from './offer.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('recruitment-offers')
@ApiBearerAuth()
@Controller('recruitment/offers')
export class OfferController {
  constructor(private readonly offers: OfferService) {}

  // Placed before the ':id' route below so "signature-sync" is never
  // matched as an :id value — same ordering InterviewController/
  // CandidateController use for their own failures endpoints.
  @Get('signature-sync/failures')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'List offers with a failed signature sync',
    description: 'Every offer whose last e-signature send attempt failed (signatureSyncFailedAt is set), newest failure first — the source list behind the recruitment "needs attention" widget.',
  })
  findWithFailedSignatureSync() {
    return this.offers.findWithFailedSignatureSync();
  }

  @Post()
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Create a draft offer',
    description: 'At most one offer per application — a second call for the same jobApplicationId is rejected. proposedSalary must be positive. Defaults to the DocuSign provider if signatureProviderCode is omitted.',
  })
  create(@Body() body: Parameters<OfferService['create']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.offers.create(body, user.id);
  }

  @Get(':id')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'Get an offer',
    description: "Includes the offer's own application, candidate, and vacancy.",
  })
  findOne(@Param('id') id: string) {
    return this.offers.findOne(id);
  }

  @Post(':id/submit')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Submit a draft offer for approval',
    description: 'Only a DRAFT offer can be submitted. Starts a RECRUITMENT_OFFER workflow instance (e.g. compensation-band approval) and moves the offer to PENDING_APPROVAL.',
  })
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.submitForApproval(id, user.id);
  }

  @Post(':id/refresh-approval')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: "Reconcile an offer with its own workflow instance",
    description: 'Call after acting on the linked workflow instance. Moves the offer to APPROVED or WITHDRAWN depending on the instance\'s own outcome; a no-op if the instance is still pending or the offer has no linked instance at all.',
  })
  refresh(@Param('id') id: string) {
    return this.offers.refreshApproval(id);
  }

  @Post(':id/send')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Send an approved offer to the candidate',
    description: 'Only an APPROVED offer can be sent. Generates the offer letter, marks the offer SENT, and attempts an e-signature send (best-effort — a signature-provider failure never loses the already-persisted offer state).',
  })
  send(@Param('id') id: string) {
    return this.offers.send(id);
  }

  @Post(':id/retry-signature-sync')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Retry a failed signature send',
    description: 'Only valid when the offer has a recorded signature-sync failure and no existing envelope — an offer that already has an envelope has no update/void retry path yet and is rejected instead.',
  })
  retrySignatureSync(@Param('id') id: string) {
    return this.offers.retrySignatureSync(id);
  }

  /** Digital Signature Providers, Checkpoint L — see OfferService.checkSignatureStatus's own doc comment. */
  @Post(':id/check-signature-status')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: "Reconcile an offer's signature status with the provider",
    description: 'Only meaningful for a SENT offer with an outstanding envelope; queries the provider directly and, if the envelope is now COMPLETED or DECLINED, records the response the same way the candidate portal\'s own respond endpoint would.',
  })
  checkSignatureStatus(@Param('id') id: string) {
    return this.offers.checkSignatureStatus(id);
  }

  @Post(':id/withdraw')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Withdraw an offer',
    description: 'Sets the offer to WITHDRAWN regardless of its current status, and best-effort voids any outstanding signature envelope (a void failure is logged, not thrown — the withdrawal itself always succeeds).',
  })
  withdraw(@Param('id') id: string) {
    return this.offers.withdraw(id);
  }
}
