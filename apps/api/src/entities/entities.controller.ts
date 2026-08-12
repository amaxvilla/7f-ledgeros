import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EntitiesService } from './entities.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('entities')
@ApiBearerAuth()
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a legal entity', description: 'code/name/legalName are required; baseCurrency, fiscalYearStartMonth, and isConsolidationParent all fall back to real server-side defaults when omitted. code must be unique.' })
  @RequirePermissions('entity.manage')
  create(@Body() dto: CreateEntityDto) {
    return this.entitiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List every entity', description: 'Includes each entity\'s immediate subsidiaries, but not the full multi-level hierarchy chain — see GET /entities/:id/hierarchy for that.' })
  @RequirePermissions('entity.view')
  findAll() {
    return this.entitiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one entity, including its immediate subsidiaries and parent' })
  @RequirePermissions('entity.view')
  findOne(@Param('id') id: string) {
    return this.entitiesService.findOne(id);
  }

  @Get(':id/hierarchy')
  @ApiOperation({ summary: 'Walk this entity\'s full parent chain up to its top-level consolidation parent' })
  @RequirePermissions('entity.view')
  getHierarchy(@Param('id') id: string) {
    return this.entitiesService.getHierarchyChain(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an entity\'s fields', description: 'Partial update — every field is optional here even though most are required on create. Cannot clear parentEntityId back to null once set (omitting it leaves the existing value untouched, it does not accept an explicit null).' })
  @RequirePermissions('entity.manage')
  update(@Param('id') id: string, @Body() dto: UpdateEntityDto) {
    return this.entitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate an entity', description: 'Soft delete (isActive: false) — the row is never removed, and there is no corresponding reactivate endpoint.' })
  @RequirePermissions('entity.manage')
  deactivate(@Param('id') id: string) {
    return this.entitiesService.deactivate(id);
  }
}
