import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryDomain } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Master data ----

  @Post('warehouses')
  @ApiOperation({ summary: 'Create a warehouse for an entity' })
  @RequirePermissions('inventory.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createWarehouse(@Body() body: { entityId: string; code: string; name: string }) {
    return this.inventory.createWarehouse(body.entityId, body.code, body.name);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List warehouses', description: 'RLS-scoped to the caller\'s entity access; optionally further filtered by entityId.' })
  @RequirePermissions('inventory.view')
  async findWarehouses(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findWarehouses(scope, entityId);
  }

  @Post('stock-items')
  @ApiOperation({ summary: 'Create a stock item (a warehouse-trackable SKU)', description: 'domain (e.g. construction materials vs consumables) partitions the catalog for filtering — it does not affect how movements/valuation work.' })
  @RequirePermissions('inventory.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createStockItem(
    @Body() body: { entityId: string; code: string; name: string; domain: InventoryDomain; unitOfMeasure: string },
  ) {
    return this.inventory.createStockItem(body.entityId, body.code, body.name, body.domain, body.unitOfMeasure);
  }

  @Get('stock-items')
  @ApiOperation({ summary: 'List stock items', description: 'RLS-scoped to the caller\'s entity access; optionally further filtered by entityId and/or domain.' })
  @RequirePermissions('inventory.view')
  async findStockItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('domain') domain?: InventoryDomain,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findStockItems(scope, entityId, domain);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get on-hand quantity and average unit cost for one item at one warehouse' })
  @RequirePermissions('inventory.view')
  getBalance(@Query('stockItemId') stockItemId: string, @Query('warehouseId') warehouseId: string) {
    return this.inventory.getBalance(stockItemId, warehouseId);
  }

  // ---- Goods Receipt ----

  @Post('goods-receipts')
  @ApiOperation({ summary: 'Create a draft goods receipt' })
  @RequirePermissions('inventory.transact')
  createGoodsReceipt(
    @Body() body: Omit<Parameters<InventoryService['createGoodsReceipt']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createGoodsReceipt({ ...body, createdById: user.id });
  }

  @Post('goods-receipts/:id/post')
  @ApiOperation({ summary: 'Post a draft goods receipt', description: 'Increases on-hand quantity for every line and recomputes each item\'s weighted-average unit cost.' })
  @RequirePermissions('inventory.post')
  postGoodsReceipt(@Param('id') id: string) {
    return this.inventory.postGoodsReceipt(id);
  }

  // ---- Material Issue ----

  @Post('material-issues')
  @ApiOperation({ summary: 'Create a draft material issue' })
  @RequirePermissions('inventory.transact')
  createMaterialIssue(
    @Body() body: Omit<Parameters<InventoryService['createMaterialIssue']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createMaterialIssue({ ...body, createdById: user.id });
  }

  @Post('material-issues/:id/post')
  @ApiOperation({ summary: 'Post a draft material issue', description: 'Rejects with 400 if any line would take on-hand quantity negative — there is no backorder/negative-stock concept.' })
  @RequirePermissions('inventory.post')
  postMaterialIssue(@Param('id') id: string) {
    return this.inventory.postMaterialIssue(id);
  }

  // ---- Stock Transfer ----

  @Post('stock-transfers')
  @ApiOperation({ summary: 'Create a draft transfer between two warehouses' })
  @RequirePermissions('inventory.transact')
  createStockTransfer(
    @Body() body: Omit<Parameters<InventoryService['createStockTransfer']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createStockTransfer({ ...body, createdById: user.id });
  }

  @Post('stock-transfers/:id/post')
  @ApiOperation({ summary: 'Post a draft stock transfer', description: 'Same insufficient-stock rejection as posting a material issue applies to the source warehouse.' })
  @RequirePermissions('inventory.post')
  postStockTransfer(@Param('id') id: string) {
    return this.inventory.postStockTransfer(id);
  }

  // ---- Stock Count ----

  @Post('stock-counts')
  @ApiOperation({ summary: 'Create a draft physical stock count' })
  @RequirePermissions('inventory.transact')
  createStockCount(
    @Body() body: Omit<Parameters<InventoryService['createStockCount']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createStockCount({ ...body, createdById: user.id });
  }

  @Post('stock-counts/:id/post')
  @ApiOperation({ summary: 'Post a draft stock count', description: 'Only lines whose counted-vs-system variance exceeds a small tolerance produce an adjustment movement — negligible variances are silently skipped, not adjusted to zero.' })
  @RequirePermissions('inventory.post')
  postStockCount(@Param('id') id: string) {
    return this.inventory.postStockCount(id);
  }
}
