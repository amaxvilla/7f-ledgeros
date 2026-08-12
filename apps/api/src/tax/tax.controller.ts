import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { CreateTaxCodeDto, RemitTaxPeriodDto, TaxPositionQueryDto } from './dto/tax.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';

@ApiTags('tax')
@ApiBearerAuth()
@Controller('tax')
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  // ---- Tax Codes ----

  @Post('codes')
  @ApiOperation({ summary: 'Create a tax code (WHT or VAT rate)' })
  @RequirePermissions('tax.manage')
  createTaxCode(@Body() body: CreateTaxCodeDto) {
    return this.tax.createTaxCode(body);
  }

  @Get('codes')
  @ApiOperation({ summary: 'List tax codes', description: 'taxType filter is optional; omit for both WHT and VAT.' })
  @RequirePermissions('tax.view')
  findTaxCodes(@Query('taxType') taxType?: 'WHT' | 'VAT') {
    return this.tax.findTaxCodes(taxType);
  }

  // ---- Tax Position / Return ----

  @Get('position')
  @ApiOperation({
    summary: 'Get the WHT/VAT position for a date range',
    description: 'Period-bounded (periodStart/periodEnd required) — every WHT/VAT line in that window, any status, not just pending.',
  })
  @RequirePermissions('tax.view')
  getTaxPosition(@Query() query: TaxPositionQueryDto) {
    return this.tax.getTaxPosition(query);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get the current outstanding WHT/VAT for an entity',
    description: 'Unbounded by date — every still-PENDING WHT/VAT line as of now, the dashboard-style counterpart to the period-bounded position endpoint above.',
  })
  @RequirePermissions('tax.view')
  getTaxOverview(@Query('entityId') entityId: string) {
    return this.tax.getTaxOverview(entityId);
  }

  // ---- Bulk remittance ----

  // Release O — Entity-Level Security: previously any tax.remit holder
  // could remit tax for any entity.
  @Post('remit-period')
  @ApiOperation({
    summary: 'Remit all WHT/VAT for a period in one action',
    description: 'Computes the same position getTaxPosition would for the given range, then settles every line in it — a single server-side computation over many tax lines, not a per-line action.',
  })
  @RequirePermissions('tax.remit')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  remitPeriod(@Body() body: RemitTaxPeriodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tax.remitPeriod(body, user.id);
  }
}
