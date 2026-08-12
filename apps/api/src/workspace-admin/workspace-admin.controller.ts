import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceAdminService } from './workspace-admin.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateDirectoryUserDto, SuspendDirectoryUserDto, DeleteDirectoryUserDto } from './dto/workspace-admin.dto';

@ApiTags('workspace-admin')
@ApiBearerAuth()
@Controller('workspace-admin/users')
export class WorkspaceAdminController {
  constructor(private readonly workspaceAdmin: WorkspaceAdminService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a directory user via the given workspace provider',
    description:
      'A thin call-through to the provider registry -- this service has no Prisma persistence and no opinion on what should trigger provisioning a user; mirrors ContactsService/TasksService\'s own same scope decision elsewhere in this codebase.',
  })
  @RequirePermissions('workspaceadmin.manage')
  create(@Body() dto: CreateDirectoryUserDto) {
    return this.workspaceAdmin.createUser(dto);
  }

  @Post(':providerUserId/suspend')
  @ApiOperation({ summary: 'Suspend or unsuspend a directory user via the given workspace provider' })
  @RequirePermissions('workspaceadmin.manage')
  suspend(@Param('providerUserId') providerUserId: string, @Body() dto: SuspendDirectoryUserDto) {
    return this.workspaceAdmin.setUserSuspended(providerUserId, dto);
  }

  @Delete(':providerUserId')
  @ApiOperation({ summary: 'Delete a directory user via the given workspace provider' })
  @RequirePermissions('workspaceadmin.manage')
  remove(@Param('providerUserId') providerUserId: string, @Body() dto: DeleteDirectoryUserDto) {
    return this.workspaceAdmin.deleteUser(providerUserId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List directory users via the given workspace provider, optionally filtered to one org unit path' })
  @RequirePermissions('workspaceadmin.view')
  list(@Query('providerCode') providerCode: string, @Query('orgUnitPath') orgUnitPath?: string, @Query('maxResults') maxResults?: string) {
    return this.workspaceAdmin.listUsers(providerCode, orgUnitPath, maxResults ? Number(maxResults) : undefined);
  }
}
