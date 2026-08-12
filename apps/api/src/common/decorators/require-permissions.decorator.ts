import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares which permission codes (e.g. "gl.journal.post") a route requires.
 * A user must hold at least one role granting ALL listed permission codes.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
