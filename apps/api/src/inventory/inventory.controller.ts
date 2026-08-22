import { Body, Controller, Get, Param, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryDomain } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { BulkCreateStockItemDto } from './dto/bulk-create-stock-item.dto';
import { InventoryAccountingService } from './accounting/inventory-accounting.service';
import type { InventoryAccountConfiguration } from './accounting/inventory-accounting.types';
import { InventoryExportService } from './exports/inventory-export.service';
import type { InventoryExportType } from './exports/inventory-export.types';
import { InventoryImportService } from './imports/inventory-import.service';
import type { InventoryImportPreview } from './imports/inventory-import.types';
import { InventoryReconciliationService } from './reconciliation/inventory-reconciliation.service';
import type { InventoryReconciliationRequest } from './reconciliation/inventory-reconciliation.types';
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
    private readonly inventoryAccounting: InventoryAccountingService,
    private readonly inventoryImport: InventoryImportService,
    private readonly inventoryExport: InventoryExportService,
    private readonly inventoryReconciliation: InventoryReconciliationService,
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
  @ApiOperation({ summary: 'Create a stock item (a warehouse-trackable SKU)', description: 'domain (e.g. construction materials vs consumables) partitions the catalog for filtering â€” it does not affect how movements/valuation work.' })
  @RequirePermissions('inventory.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createStockItem(
    @Body() body: { entityId: string; code: string; name: string; domain: InventoryDomain; unitOfMeasure: string },
  ) {
    return this.inventory.createStockItem(body.entityId, body.code, body.name, body.domain, body.unitOfMeasure);
  }

  @Post('stock-items/bulk')
  @ApiOperation({ summary: 'Bulk create stock items', description: 'Creates multiple stock items in a single transaction.' })
  @RequirePermissions('inventory.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createStockItemsBulk(@Body() body: BulkCreateStockItemDto) {
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }
    return this.inventory.createStockItemsBulk(body.entityId, body.items);
  }

  @Get('warehouses/:id')
  async getWarehouse(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.getWarehouse(id, scope);
  }

  @Patch('warehouses/:id')
  async updateWarehouse(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      isActive?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.updateWarehouse(id, body, scope);
  }

  @Get('stock-items/:id')
  async getStockItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.getStockItem(id, scope);
  }

  @Patch('stock-items/:id')
  async updateStockItem(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      domain?: InventoryDomain;
      unitOfMeasure?: string;
      isActive?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.updateStockItem(id, body, scope);
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
  async getBalance(
    @Query('stockItemId') stockItemId: string,
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.getBalance(stockItemId, warehouseId, scope);
  }

  // ---- Inventory read models ----

  @Get('goods-receipts')
  @ApiOperation({ summary: 'List goods receipts visible to the caller' })
  @RequirePermissions('inventory.view')
  async findGoodsReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findGoodsReceipts(
      scope,
      entityId,
      Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }

  @Get('material-issues')
  @ApiOperation({ summary: 'List material issues visible to the caller' })
  @RequirePermissions('inventory.view')
  async findMaterialIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findMaterialIssues(
      scope,
      entityId,
      Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }

  @Get('stock-transfers')
  @ApiOperation({ summary: 'List stock transfers visible to the caller' })
  @RequirePermissions('inventory.view')
  async findStockTransfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findStockTransfers(
      scope,
      entityId,
      Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }

  @Get('stock-counts')
  @ApiOperation({ summary: 'List stock counts visible to the caller' })
  @RequirePermissions('inventory.view')
  async findStockCounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findStockCounts(
      scope,
      entityId,
      Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }

  @Get('movements')
  @ApiOperation({ summary: 'List stock movements visible to the caller' })
  @RequirePermissions('inventory.view')
  async findStockMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('stockItemId') stockItemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.findStockMovements(
      scope,
      entityId,
      stockItemId,
      warehouseId,
      Math.min(Math.max(Number(limit) || 200, 1), 500),
    );
  }

  // --------------------------------------------------
  // ERP inventory operations
  // --------------------------------------------------

  @Post('imports/preview')
  @ApiOperation({ summary: 'Validate inventory import rows without posting stock' })
  @RequirePermissions('inventory.manage')
  async previewImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { rows: Record<string, unknown>[] },
  ) {
    await this.securityContext.buildScope(user);
    return this.inventoryImport.preview(body.rows);
  }

  @Post('imports/commit')
  @ApiOperation({ summary: 'Commit a validated inventory import' })
  @RequirePermissions('inventory.transact')
  async commitImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InventoryImportPreview,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventoryImport.importValidated(body, scope);
  }

  @Get('exports/:type')
  @ApiOperation({ summary: 'Export secured inventory data as CSV' })
  @RequirePermissions('inventory.view')
  async exportInventory(
    @CurrentUser() _user: AuthenticatedUser,
    @Param('type') type: InventoryExportType,
    @Query('entityId') entityId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('stockItemId') stockItemId?: string,
  ) {
    return this.inventoryExport.export({
      type,
      entityId,
      fromDate,
      toDate,
      warehouseId,
      stockItemId,
    });
  }

  @Post('reconciliation')
  @ApiOperation({ summary: 'Reconcile inventory valuation to the GL control account' })
  @RequirePermissions('inventory.view')
  async reconcileInventory(
    @CurrentUser() _user: AuthenticatedUser,
    @Body() body: InventoryReconciliationRequest,
  ) {
    return this.inventoryReconciliation.reconcile(body);
  }
  @Get('accounting/config/:entityId')
  @ApiOperation({ summary: 'Get inventory accounting configuration' })
  @RequirePermissions('inventory.view')
  async getInventoryAccountingConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityId') entityId: string,
  ) {
    await this.securityContext.buildScope(user);
    return this.inventoryAccounting.getConfiguration(entityId);
  }

  @Post('accounting/config/:entityId')
  @ApiOperation({ summary: 'Configure inventory accounting accounts for an entity' })
  @RequirePermissions('inventory.manage')
  async configureInventoryAccounting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityId') entityId: string,
    @Body()
    body: Omit<InventoryAccountConfiguration, 'entityId' | 'isActive'>,
  ) {
    await this.securityContext.buildScope(user);

    return this.inventoryAccounting.configure(
      entityId,
      body,
    );
  }
  // ---- Goods Receipt ----

  @Post('goods-receipts')
  @ApiOperation({ summary: 'Create a draft goods receipt' })
  @RequirePermissions('inventory.transact')
  async createGoodsReceipt(
    @Body() body: Omit<Parameters<InventoryService['createGoodsReceipt']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.createGoodsReceipt({ ...body, createdById: user.id }, scope);
  }

  @Post('goods-receipts/:id/post')
  @ApiOperation({ summary: 'Post a draft goods receipt', description: 'Increases on-hand quantity for every line and recomputes each item\'s weighted-average unit cost.' })
  @RequirePermissions('inventory.post')
  async postGoodsReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.postGoodsReceipt(id, scope);
  }

  // ---- Material Issue ----

  @Post('material-issues')
  @ApiOperation({ summary: 'Create a draft material issue' })
  @RequirePermissions('inventory.transact')
  async createMaterialIssue(
    @Body() body: Omit<Parameters<InventoryService['createMaterialIssue']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.createMaterialIssue({ ...body, createdById: user.id }, scope);
  }

  @Post('material-issues/:id/post')
  @ApiOperation({ summary: 'Post a draft material issue', description: 'Rejects with 400 if any line would take on-hand quantity negative â€” there is no backorder/negative-stock concept.' })
  @RequirePermissions('inventory.post')
  async postMaterialIssue(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.postMaterialIssue(id, scope);
  }

  // ---- Stock Transfer ----

  @Post('stock-transfers')
  @ApiOperation({ summary: 'Create a draft transfer between two warehouses' })
  @RequirePermissions('inventory.transact')
  async createStockTransfer(
    @Body() body: Omit<Parameters<InventoryService['createStockTransfer']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.createStockTransfer({ ...body, createdById: user.id }, scope);
  }

  @Post('stock-transfers/:id/post')
  @ApiOperation({ summary: 'Post a draft stock transfer', description: 'Same insufficient-stock rejection as posting a material issue applies to the source warehouse.' })
  @RequirePermissions('inventory.post')
  async postStockTransfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.postStockTransfer(id, scope);
  }

  // ---- Stock Count ----

  @Post('stock-counts')
  @ApiOperation({ summary: 'Create a draft physical stock count' })
  @RequirePermissions('inventory.transact')
  async createStockCount(
    @Body() body: Omit<Parameters<InventoryService['createStockCount']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.createStockCount({ ...body, createdById: user.id }, scope);
  }

  @Post('stock-counts/:id/post')
  @ApiOperation({ summary: 'Post a draft stock count', description: 'Only lines whose counted-vs-system variance exceeds a small tolerance produce an adjustment movement â€” negligible variances are silently skipped, not adjusted to zero.' })
  @RequirePermissions('inventory.post')
  async postStockCount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.inventory.postStockCount(id, scope);
  }
}


