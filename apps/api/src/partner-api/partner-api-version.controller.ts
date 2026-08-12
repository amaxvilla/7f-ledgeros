import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

/**
 * API Gateway, Checkpoint E — Versioning. Lives at the UNVERSIONED
 * `partner-api` path (`/api/v1/partner-api/version`), deliberately
 * outside PartnerApiController's own new `partner-api/v1` prefix — a
 * partner needs to be able to discover which versions exist BEFORE
 * committing to a versioned URL, so this one route can never itself be
 * versioned away.
 *
 * WHY THE PARTNER API NEEDS ITS OWN VERSION NUMBER, SEPARATE FROM
 * main.ts's EXISTING `api/v1` GLOBAL PREFIX: that prefix versions this
 * codebase's ENTIRE internal API as one unit — every internal
 * controller moves in lockstep because internal callers (this
 * codebase's own frontend) always deploy against the same backend
 * commit. A partner integration doesn't: an external partner's own
 * integration code was written against whatever partner-api shape
 * existed when they built it, and deploys on its own schedule,
 * completely decoupled from this codebase's own release cadence. If a
 * future breaking change to (say) the payment status response shape
 * shipped under the SAME version number the internal API already
 * happens to be on, every existing partner integration would break the
 * next production deploy with zero warning. An independent partner-api
 * version number is what makes `/partner-api/v2/...` addable later
 * (Checkpoint C/D's PartnerApiController's own routes staying on v1
 * unchanged) without that collision.
 *
 * No @UseGuards(ApiKeyGuard, ...) here — unlike every route on
 * PartnerApiController, version discovery must be answerable without
 * an API key at all (a partner without one yet still needs to know
 * what to build against), and there's nothing partner-specific to
 * scope-check or rate-limit against something as static as this.
 * @Public() is still required, for the identical reason
 * PartnerApiController's own doc comment gives — this controller has no
 * JWT to present either.
 */
@ApiTags('partner-api')
@Public()
@Controller('partner-api')
export class PartnerApiVersionController {
  @Get('version')
  @ApiOperation({
    summary: 'List the partner API versions this deployment currently supports',
    description: 'No API key required -- a partner without one yet still needs to know what to build against. Lives outside PartnerApiController\'s own versioned prefix so this route itself can never be versioned away.',
  })
  version() {
    return { current: 'v1', supported: ['v1'], deprecated: [] };
  }
}
