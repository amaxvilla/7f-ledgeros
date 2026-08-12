import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';

@ApiTags('chart-of-accounts')
@ApiBearerAuth()
@Controller('accounts')
export class ChartOfAccountsController {
  constructor(private readonly coaService: ChartOfAccountsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a group-chart account',
    description: 'Accounts are global to the group (one shared chart across every entity, not entity-scoped) — code must be unique across the whole chart.',
  })
  @RequirePermissions('coa.manage')
  create(@Body() dto: CreateAccountDto) {
    return this.coaService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List group-chart accounts', description: 'Filterable by accountType and activeOnly; both optional.' })
  @RequirePermissions('coa.view')
  findAll(@Query('accountType') accountType?: string, @Query('activeOnly') activeOnly?: string) {
    return this.coaService.findAll({ accountType, activeOnly: activeOnly === 'true' });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a group-chart account by id' })
  @RequirePermissions('coa.view')
  findOne(@Param('id') id: string) {
    return this.coaService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a group-chart account',
    description: 'A soft delete (isActive=false) on the group-wide account itself — separate from, and does not affect, any entity\'s own per-entity activation via EntityAccount.',
  })
  @RequirePermissions('coa.manage')
  deactivate(@Param('id') id: string) {
    return this.coaService.deactivate(id);
  }

  // Release O — Entity-Level Security: previously any coa.manage holder
  // could activate an account for any entity.
  @Post('activate-for-entity')
  @ApiOperation({
    summary: 'Activate a group-chart account for use by one entity',
    description: 'Upserts the EntityAccount join row that makes a group-chart account postable for that specific entity — the group-chart account itself is created separately and shared across all entities.',
  })
  @RequirePermissions('coa.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  activateForEntity(@Body() dto: ActivateAccountDto) {
    return this.coaService.activateForEntity(dto);
  }

  @Get('entity/:entityId/active')
  @ApiOperation({ summary: "List an entity's own active (postable) accounts" })
  @RequirePermissions('coa.view')
  findActiveForEntity(@Param('entityId') entityId: string) {
    return this.coaService.findActiveForEntity(entityId);
  }
}
