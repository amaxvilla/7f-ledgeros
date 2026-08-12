import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FixedAssetStatus } from '@prisma/client';
import { FixedAssetsService } from './fixed-assets.service';
import {
  CreateAssetCategoryDto,
  CreateFixedAssetDto,
  DisposeAssetDto,
  RunDepreciationDto,
} from './dto/fixed-assets.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('fixed-assets')
@ApiBearerAuth()
@Controller('fixed-assets')
export class FixedAssetsController {
  constructor(
    private readonly fixedAssets: FixedAssetsService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Asset Categories ----

  @Post('categories')
  @ApiOperation({ summary: 'Create an asset category', description: 'Depreciation method/useful life defaults for assets assigned to this category.' })
  @RequirePermissions('fixedasset.manage')
  createAssetCategory(@Body() body: CreateAssetCategoryDto) {
    return this.fixedAssets.createAssetCategory(body);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List asset categories' })
  @RequirePermissions('fixedasset.view')
  findAssetCategories() {
    return this.fixedAssets.findAssetCategories();
  }

  // ---- Fixed Asset Register ----

  @Post()
  @ApiOperation({
    summary: 'Register a fixed asset',
    description: 'assetTag must be unique per entity. residualValue defaults to 0 and can never exceed acquisitionCost.',
  })
  @RequirePermissions('fixedasset.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createFixedAsset(@Body() body: CreateFixedAssetDto) {
    return this.fixedAssets.createFixedAsset(body);
  }

  @Get()
  @ApiOperation({ summary: 'List fixed assets', description: 'entityId and status are both optional filters; RLS-scoped to the caller regardless.' })
  @RequirePermissions('fixedasset.view')
  async findFixedAssets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: FixedAssetStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.fixedAssets.findFixedAssets(scope, entityId, status);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get fixed asset register totals for an entity' })
  @RequirePermissions('fixedasset.view')
  getFixedAssetSummary(@Query('entityId') entityId?: string) {
    return this.fixedAssets.getFixedAssetSummary(entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a fixed asset by id' })
  @RequirePermissions('fixedasset.view')
  findFixedAssetById(@Param('id') id: string) {
    return this.fixedAssets.findFixedAssetById(id);
  }

  // ---- Depreciation ----

  @Post('depreciation/run')
  @ApiOperation({
    summary: 'Run depreciation for a period, for every active asset of an entity',
    description: 'A single batch call, not per-asset — processes every ACTIVE asset of the given entity acquired on or before the period, skipping any that are not due (each result line states its own outcome, including a skip reason where relevant).',
  })
  @RequirePermissions('fixedasset.depreciate')
  runDepreciation(@Body() body: RunDepreciationDto) {
    return this.fixedAssets.runDepreciation(body);
  }

  // ---- Disposal ----

  @Post(':id/dispose')
  @ApiOperation({
    summary: 'Dispose a fixed asset',
    description: 'Terminal — rejected if already disposed. Computes gain/loss as disposalProceeds minus net book value at disposal (acquisition cost less accumulated depreciation) and posts it.',
  })
  @RequirePermissions('fixedasset.dispose')
  disposeAsset(@Param('id') id: string, @Body() body: DisposeAssetDto) {
    return this.fixedAssets.disposeAsset(id, body);
  }
}
