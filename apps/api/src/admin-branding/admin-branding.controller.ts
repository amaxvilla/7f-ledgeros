import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrandAssetType, DocumentTemplateType } from '@prisma/client';
import { AdminBrandingService, UploadedFileLike } from './admin-branding.service';
import { UpsertEntityProfileDto } from './dto/upsert-entity-profile.dto';
import { UpsertBrandingProfileDto } from './dto/upsert-branding-profile.dto';
import { UploadBrandAssetDto } from './dto/upload-brand-asset.dto';
import { UpsertDocumentTemplateDto } from './dto/upsert-document-template.dto';
import { UpsertUserPreferenceDto } from './dto/upsert-user-preference.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin-branding')
@ApiBearerAuth()
@Controller('admin')
export class AdminBrandingController {
  constructor(private readonly admin: AdminBrandingService) {}

  // ---- Company profile ----

  @Put('entities/:entityId/profile')
  @ApiOperation({ summary: 'Create or update one entity\'s company profile', description: 'Upserts EntityProfile by entityId. Returns 404 if the entity itself does not exist — no profile is created for an unknown entity.' })
  @RequirePermissions('admin.branding.manage')
  upsertEntityProfile(@Param('entityId') entityId: string, @Body() dto: UpsertEntityProfileDto) {
    return this.admin.upsertEntityProfile(entityId, dto);
  }

  @Get('entities/:entityId/profile')
  @ApiOperation({ summary: 'Get one entity\'s company profile', description: 'Returns null (not a 404) if no profile has ever been set for this entity — a missing profile is a valid, unconfigured state, not an error.' })
  @RequirePermissions('admin.branding.view')
  getEntityProfile(@Param('entityId') entityId: string) {
    return this.admin.getEntityProfile(entityId);
  }

  // ---- Branding / theme / locale ----

  @Put('entities/:entityId/branding')
  @ApiOperation({ summary: 'Create or update one entity\'s branding/theme/locale profile', description: 'Upserts EntityBrandingProfile (colors, theme mode, white-label flag, language/timezone/number-format defaults) by entityId. Returns 404 if the entity itself does not exist.' })
  @RequirePermissions('admin.branding.manage')
  upsertBrandingProfile(@Param('entityId') entityId: string, @Body() dto: UpsertBrandingProfileDto) {
    return this.admin.upsertBrandingProfile(entityId, dto);
  }

  @Get('entities/:entityId/branding')
  @ApiOperation({ summary: 'Get one entity\'s branding/theme/locale profile', description: 'Returns a real, documented set of default values (navy/gold theme, English, Africa/Lagos timezone) rather than null or a 404 when no profile has been configured yet, so callers never need to special-case an unconfigured entity.' })
  @RequirePermissions('admin.branding.view')
  getBrandingProfile(@Param('entityId') entityId: string) {
    return this.admin.getBrandingProfile(entityId);
  }

  @Get('entities/:entityId/branding/resolve')
  @ApiOperation({ summary: 'Effective branding for the current user at one entity', description: 'Merges the entity\'s own branding profile (or its built-in defaults) with the calling user\'s own personal theme/language/timezone overrides from their UserPreference, if any — the personal overrides win field by field where set.' })
  @RequirePermissions('admin.branding.view')
  resolveBranding(@Param('entityId') entityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.resolveBranding(entityId, user.id);
  }

  // ---- Brand assets ----

  @Post('entities/:entityId/brand-assets')
  @ApiOperation({ summary: 'Upload one brand asset (logo, letterhead, watermark, stamp, signature)', description: 'multipart/form-data file upload, stored via the configured storage provider under a per-entity/per-asset-type key. If isDefault is set, any existing default asset of the same (entity, assetType) pair is demoted first — at most one default per entity/type at a time.' })
  @RequirePermissions('admin.branding.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadBrandAsset(
    @Param('entityId') entityId: string,
    @Body() dto: UploadBrandAssetDto,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.uploadBrandAsset(entityId, dto, file, user.id);
  }

  @Get('entities/:entityId/brand-assets')
  @ApiOperation({ summary: 'List one entity\'s brand assets', description: 'Optionally narrowed to one assetType (e.g. LOGO); omitting it returns every asset type, newest first.' })
  @RequirePermissions('admin.branding.view')
  listBrandAssets(@Param('entityId') entityId: string, @Query('assetType') assetType?: BrandAssetType) {
    return this.admin.listBrandAssets(entityId, assetType);
  }

  @Delete('brand-assets/:id')
  @ApiOperation({ summary: 'Delete one brand asset', description: 'Deletes the file from the storage provider first, then the database record — a real, ordered two-step delete, not a soft delete. Returns 404 if the asset does not exist.' })
  @RequirePermissions('admin.branding.manage')
  deleteBrandAsset(@Param('id') id: string) {
    return this.admin.deleteBrandAsset(id);
  }

  // ---- Document templates ----

  @Post('document-templates')
  @ApiOperation({ summary: 'Create or update one document template', description: 'Upserts by the (entityId, templateType, code) triple. entityId is required and must reference a real entity — DocumentTemplate has no system-wide default.' })
  @RequirePermissions('admin.templates.manage')
  upsertTemplate(@Body() dto: UpsertDocumentTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.upsertTemplate(dto, user.id);
  }

  @Get('document-templates')
  @ApiOperation({ summary: 'List document templates', description: 'Optionally narrowed by entityId and/or templateType; only active templates are returned, newest first.' })
  @RequirePermissions('admin.templates.view')
  listTemplates(@Query('entityId') entityId?: string, @Query('templateType') templateType?: DocumentTemplateType) {
    return this.admin.listTemplates({ entityId, templateType });
  }

  @Get('document-templates/render')
  @ApiOperation({ summary: 'Resolve and render one document template', description: 'Resolves the entity-specific template for the given templateType/code; returns 404 if none exists. Any query parameter other than entityId/templateType/code is treated as merge-tag data and substituted into {{key}} placeholders in the template\'s subject/content.' })
  @RequirePermissions('admin.templates.view')
  renderTemplate(
    @Query('entityId') entityId: string,
    @Query('templateType') templateType: DocumentTemplateType,
    @Query('code') code: string,
    @Query() query: Record<string, string>,
  ) {
    // Every query param other than the three above is merge-tag data,
    // e.g. ?entityId=..&templateType=INVOICE&code=default&customerName=Jane
    const { entityId: _e, templateType: _t, code: _c, ...data } = query;
    return this.admin.renderTemplate(entityId, templateType, code, data);
  }

  // ---- User preferences ----

  // Settings, FE-1.8 — a real bug found and fixed here, not a new
  // feature: both endpoints below were gated behind
  // `@RequirePermissions('admin.branding.view')`, an ADMIN permission,
  // even though they act only on the calling user's own id
  // (`user.id`, never a supplied one — confirmed by reading both
  // method bodies directly). That gate meant any seeded role without
  // admin.branding.view (i.e. almost every non-admin role — confirmed
  // by grepping `packages/config/src/roles.ts`) would get a 403 trying
  // to set their own theme/language/timezone. Every other genuine
  // self-service `*/me` endpoint in this app (`security-hardening`'s
  // `sessions/me`, `devices/me`, `login-history/me` — confirmed by
  // reading that controller directly before making this change) has no
  // `@RequirePermissions` at all, gated only by the global auth guard —
  // this pair is brought into line with that established convention,
  // not given a new one.
  @Put('me/preferences')
  @ApiOperation({ summary: 'Create or update the current user\'s own personal preferences', description: 'Upserts UserPreference (theme/language/timezone overrides) for the calling user only — always acts on the authenticated user\'s own id, never a supplied one. Self-service: no permission beyond being authenticated is required, matching every other */me endpoint in this app.' })
  upsertMyPreference(@Body() dto: UpsertUserPreferenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.upsertUserPreference(user.id, dto);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get the current user\'s own personal preferences', description: 'Returns null if the calling user has never set any personal overrides — a real, valid "using entity defaults" state, not an error. Self-service: no permission beyond being authenticated is required, matching every other */me endpoint in this app.' })
  getMyPreference(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getUserPreference(user.id);
  }

  // ---- Translations ----

  @Post('translations')
  @ApiOperation({ summary: 'Create or update one translation entry', description: 'Upserts by the (locale, namespace, key) triple in this app\'s minimal i18n store — a single key\'s value is replaced in place, nothing else in the namespace is touched.' })
  @RequirePermissions('admin.branding.manage')
  upsertTranslation(@Body() dto: UpsertTranslationDto) {
    return this.admin.upsertTranslation(dto);
  }

  @Get('translations')
  @ApiOperation({ summary: 'Get all translation entries for one locale', description: 'Optionally narrowed to one namespace; omitting it returns every namespace for the locale. Returned as a flat { "namespace.key": value } map, not the underlying per-row shape.' })
  @RequirePermissions('admin.branding.view')
  getTranslations(@Query('locale') locale: string, @Query('namespace') namespace?: string) {
    return this.admin.getTranslations(locale, namespace);
  }
}
