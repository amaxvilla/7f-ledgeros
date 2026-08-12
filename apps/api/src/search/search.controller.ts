import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Global search (FE-1's last open gap — see SearchService's own doc
 * comment for the full scoping rationale). Self-service, no
 * `@RequirePermissions` on the route itself — see SearchService for why
 * each category is gated individually instead.
 */
@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across customers, vendors, employees, projects, and GL accounts',
    description:
      'Self-service — each category is silently omitted when the caller lacks that category\'s own view permission (ar.view/ap.view/hr.view/pmo.view/coa.view). entityId scopes the employee/project categories only (customer/vendor/account are global master data with no entityId column).',
  })
  async globalSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.search.search(q ?? '', entityId ?? '', user.permissions ?? []);
  }
}
