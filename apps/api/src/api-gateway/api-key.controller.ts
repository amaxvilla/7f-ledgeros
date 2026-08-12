import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import { GenerateApiKeyDto, RevokeApiKeyDto } from './dto/api-key.dto';

/**
 * API Gateway, Checkpoint A. Ordinary JWT+RBAC-protected admin
 * endpoints for MANAGING keys — not the partner-facing surface those
 * keys will eventually authenticate INTO (see ApiKeyGuard's own doc
 * comment for why that's a separate, later checkpoint).
 */
@ApiTags('api-gateway')
@ApiBearerAuth()
@Controller('api-gateway/keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Generate a new partner API key for an entity',
    description: 'The raw key is only ever returned in this response, once -- only its hash and a short display prefix are stored; it cannot be retrieved again after this call.',
  })
  @RequirePermissions('api_gateway.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  generate(@Body() dto: GenerateApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.generateKey(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys, optionally filtered by entity', description: 'Never returns keyHash, even though it is a one-way hash -- general \'do not expose internal secrets\' hygiene.' })
  @RequirePermissions('api_gateway.view')
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.apiKeys.findKeys(scope, entityId);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an API key', description: 'Rejected with a 409 if the key is already revoked -- not a silent no-op.' })
  @RequirePermissions('api_gateway.manage')
  revoke(@Param('id') id: string, @Body() dto: RevokeApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.revokeKey(id, dto, user.id);
  }
}
