import { Injectable } from '@nestjs/common';
import { WorkspaceAdminProviderRegistry } from './workspace-admin-provider.registry';
import { CreateDirectoryUserDto, SuspendDirectoryUserDto, DeleteDirectoryUserDto } from './dto/workspace-admin.dto';

/**
 * The piece WorkspaceAdminProviderRegistry and GoogleWorkspaceAdminProvider
 * were missing: something that actually calls createUser/setUserSuspended/
 * deleteUser/listUsers. Mirrors ContactsService/TasksService exactly,
 * including their scope decision: no Prisma persistence, and no opinion
 * on what should trigger provisioning a directory user — the interface's
 * own doc comment (workspace-admin-provider.interface.ts) explicitly
 * defers "should CandidateService.hire() auto-provision one" to its own
 * later checkpoint, the same posture ContactsService's own doc comment
 * takes toward "should this CRM lead auto-sync to Outlook". This layer
 * only makes create/suspend/delete/list callable at all.
 */
@Injectable()
export class WorkspaceAdminService {
  constructor(private readonly registry: WorkspaceAdminProviderRegistry) {}

  createUser(dto: CreateDirectoryUserDto) {
    const { providerCode, ...params } = dto;
    return this.registry.get(providerCode).createUser(params);
  }

  setUserSuspended(providerUserId: string, dto: SuspendDirectoryUserDto) {
    return this.registry.get(dto.providerCode).setUserSuspended({ providerUserId, suspended: dto.suspended });
  }

  deleteUser(providerUserId: string, dto: DeleteDirectoryUserDto) {
    return this.registry.get(dto.providerCode).deleteUser({ providerUserId });
  }

  listUsers(providerCode: string, orgUnitPath?: string, maxResults?: number) {
    return this.registry.get(providerCode).listUsers({ orgUnitPath, maxResults });
  }
}
