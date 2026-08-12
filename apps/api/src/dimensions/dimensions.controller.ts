import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DimensionsService } from './dimensions.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('dimensions')
@ApiBearerAuth()
@Controller('dimensions')
export class DimensionsController {
  constructor(private readonly dimensions: DimensionsService) {}

  // ---- Projects / Phases / Blocks / Floors / Units ----

  @Post('projects')
  @ApiOperation({ summary: 'Create a project', description: 'Top of the Project → Phase → Block → Floor → Unit real-estate hierarchy. code is unique per entity, not globally.' })
  @RequirePermissions('dimension.manage')
  createProject(@Body() body: { entityId: string; code: string; name: string; description?: string }) {
    return this.dimensions.createProject(body.entityId, body.code, body.name, body.description);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List projects', description: 'entityId is an optional filter; omit it to list every project across every entity.' })
  @RequirePermissions('dimension.view')
  findProjects(@Query('entityId') entityId?: string) {
    return this.dimensions.findProjects(entityId);
  }

  @Get('projects/:id/tree')
  @ApiOperation({ summary: 'Get a project with its full hierarchy', description: 'One call returns every phase, block, floor, and unit nested underneath, not just the project row itself.' })
  @RequirePermissions('dimension.view')
  getProjectTree(@Param('id') id: string) {
    return this.dimensions.getProjectTree(id);
  }

  @Post('phases')
  @ApiOperation({ summary: 'Create a phase under a project', description: '404s if the parent project does not exist; code is unique per project, not globally.' })
  @RequirePermissions('dimension.manage')
  createPhase(@Body() body: { projectId: string; code: string; name: string }) {
    return this.dimensions.createPhase(body.projectId, body.code, body.name);
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Create a block under a phase', description: '404s if the parent phase does not exist; code is unique per phase, not globally.' })
  @RequirePermissions('dimension.manage')
  createBlock(@Body() body: { phaseId: string; code: string; name: string }) {
    return this.dimensions.createBlock(body.phaseId, body.code, body.name);
  }

  @Post('floors')
  @ApiOperation({ summary: 'Create a floor under a block', description: '404s if the parent block does not exist; code is unique per block, not globally.' })
  @RequirePermissions('dimension.manage')
  createFloor(@Body() body: { blockId: string; code: string; name: string }) {
    return this.dimensions.createFloor(body.blockId, body.code, body.name);
  }

  @Post('units')
  @ApiOperation({ summary: 'Create a unit under a floor', description: '404s if the parent floor does not exist; code is unique per floor, not globally. The bottom of the Project → Phase → Block → Floor → Unit hierarchy — this is the same Unit sold through Property Sales.' })
  @RequirePermissions('dimension.manage')
  createUnit(
    @Body()
    body: {
      floorId: string;
      code: string;
      name?: string;
      unitType?: string;
      sizeSqm?: number;
      listPrice: number;
    },
  ) {
    const { floorId, ...data } = body;
    return this.dimensions.createUnit(floorId, data);
  }

  // ---- Departments / Cost Centers / Funding Sources ----

  @Post('departments')
  @ApiOperation({ summary: 'Create a department', description: 'code is unique per entity, not globally.' })
  @RequirePermissions('dimension.manage')
  createDepartment(@Body() body: { entityId: string; code: string; name: string }) {
    return this.dimensions.createDepartment(body.entityId, body.code, body.name);
  }

  @Get('departments')
  @ApiOperation({ summary: 'List departments', description: 'entityId is an optional filter; omit it to list every department across every entity.' })
  @RequirePermissions('dimension.view')
  findDepartments(@Query('entityId') entityId?: string) {
    return this.dimensions.findDepartments(entityId);
  }

  @Post('cost-centers')
  @ApiOperation({ summary: 'Create a cost center', description: 'code is unique per entity, not globally.' })
  @RequirePermissions('dimension.manage')
  createCostCenter(@Body() body: { entityId: string; code: string; name: string }) {
    return this.dimensions.createCostCenter(body.entityId, body.code, body.name);
  }

  @Get('cost-centers')
  @ApiOperation({ summary: 'List cost centers', description: 'entityId is an optional filter; omit it to list every cost center across every entity.' })
  @RequirePermissions('dimension.view')
  findCostCenters(@Query('entityId') entityId?: string) {
    return this.dimensions.findCostCenters(entityId);
  }

  @Post('funding-sources')
  @ApiOperation({ summary: 'Create a funding source', description: 'code is unique per entity, not globally.' })
  @RequirePermissions('dimension.manage')
  createFundingSource(
    @Body() body: { entityId: string; code: string; name: string; sourceType?: string },
  ) {
    return this.dimensions.createFundingSource(body.entityId, body.code, body.name, body.sourceType);
  }

  @Get('funding-sources')
  @ApiOperation({ summary: 'List funding sources', description: 'entityId is an optional filter; omit it to list every funding source across every entity.' })
  @RequirePermissions('dimension.view')
  findFundingSources(@Query('entityId') entityId?: string) {
    return this.dimensions.findFundingSources(entityId);
  }

  // ---- Vendors / Customers ----

  @Post('vendors')
  @ApiOperation({ summary: 'Create a vendor', description: 'code is globally unique — unlike every other dimension in this controller, vendors are NOT entity-scoped.' })
  @RequirePermissions('dimension.manage')
  createVendor(
    @Body() body: { code: string; name: string; taxId?: string; bankName?: string; bankAccountNumber?: string },
  ) {
    const { code, name, ...extra } = body;
    return this.dimensions.createVendor(code, name, extra);
  }

  @Get('vendors')
  @ApiOperation({ summary: 'List every vendor', description: 'No entityId filter exists — vendors are a single global list, not scoped per entity.' })
  @RequirePermissions('dimension.view')
  findVendors() {
    return this.dimensions.findVendors();
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a customer', description: 'code is globally unique — same non-entity-scoped shape as Vendors, not per-entity like Departments/Cost Centers/Funding Sources.' })
  @RequirePermissions('dimension.manage')
  createCustomer(@Body() body: { code: string; name: string; email?: string; phone?: string }) {
    const { code, name, ...extra } = body;
    return this.dimensions.createCustomer(code, name, extra);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List every customer', description: 'No entityId filter exists — customers are a single global list, not scoped per entity.' })
  @RequirePermissions('dimension.view')
  findCustomers() {
    return this.dimensions.findCustomers();
  }
}
