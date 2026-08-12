import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * API Gateway, Checkpoint C. Mirrors CurrentUser's own shape exactly,
 * for the ApiKey record ApiKeyGuard attaches to `request.apiKey` (see
 * that guard's own doc comment) rather than the JWT-derived
 * `request.user` CurrentUser reads. Kept as a separate interface/
 * decorator pair from AuthenticatedUser/CurrentUser rather than reusing
 * either — an ApiKey and a JWT-authenticated user are not
 * interchangeable identities (no permissions[]/entityAccess[], no
 * email; scopes[] instead of permissions[]) and conflating the two
 * types would make it easy for a handler to accidentally assume a
 * field only one of them actually has.
 */
export interface RequestApiKey {
  id: string;
  entityId: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number | null;
}

export const CurrentApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestApiKey => {
  const request = ctx.switchToHttp().getRequest();
  return request.apiKey;
});
