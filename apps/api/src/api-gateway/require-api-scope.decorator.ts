import { SetMetadata } from '@nestjs/common';

export const API_SCOPE_KEY = 'apiScopes';

/**
 * API Gateway, Checkpoint C — the exact decorator ApiKeyGuard's own
 * Checkpoint A doc comment predicted ("a future @RequireApiScope
 * decorator"). Same SetMetadata + Reflector shape as
 * RequirePermissions/PermissionsGuard — a route declares which scope
 * strings an ApiKey must hold ALL of (ApiKey.scopes is a free-text
 * String[], same "caller-defined vocabulary" reasoning
 * IntegrationProvider.providerCode and BankTransfer.providerCode both
 * already use elsewhere in this codebase — no enum to keep in sync
 * across every future partner integration).
 *
 * Deliberately a SEPARATE decorator/guard pair from RequirePermissions/
 * PermissionsGuard, not reusing them — those check `request.user.permissions`
 * (a JWT-authenticated internal user's role grants); this checks
 * `request.apiKey.scopes` (an external partner's key grants). Conflating
 * the two would let a route's scope requirement silently do nothing for
 * whichever auth mode wasn't being tested at the time.
 */
export const RequireApiScope = (...scopes: string[]) => SetMetadata(API_SCOPE_KEY, scopes);
