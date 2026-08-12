import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BrandAssetType, DocumentTemplateType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.interface';
import { UpsertEntityProfileDto } from './dto/upsert-entity-profile.dto';
import { UpsertBrandingProfileDto } from './dto/upsert-branding-profile.dto';
import { UploadBrandAssetDto } from './dto/upload-brand-asset.dto';
import { UpsertDocumentTemplateDto } from './dto/upsert-document-template.dto';
import { UpsertUserPreferenceDto } from './dto/upsert-user-preference.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

// Matches what multer actually puts on req.file — kept as a local
// minimal shape instead of depending on the Express.Multer.File
// ambient type, since @types/multer isn't a declared dependency here.
export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class AdminBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // -------------------------------------------------------------------
  // COMPANY PROFILE
  // -------------------------------------------------------------------

  async upsertEntityProfile(entityId: string, dto: UpsertEntityProfileDto) {
    await this.assertEntityExists(entityId);
    return this.prisma.entityProfile.upsert({
      where: { entityId },
      create: { entityId, ...dto },
      update: { ...dto },
    });
  }

  async getEntityProfile(entityId: string) {
    return this.prisma.entityProfile.findUnique({ where: { entityId } });
  }

  // -------------------------------------------------------------------
  // BRANDING / THEME / LOCALE
  // -------------------------------------------------------------------

  async upsertBrandingProfile(entityId: string, dto: UpsertBrandingProfileDto) {
    await this.assertEntityExists(entityId);
    return this.prisma.entityBrandingProfile.upsert({
      where: { entityId },
      create: { entityId, ...dto },
      update: { ...dto },
    });
  }

  async getBrandingProfile(entityId: string) {
    const profile = await this.prisma.entityBrandingProfile.findUnique({ where: { entityId } });
    // A sensible default so callers don't have to special-case "no
    // profile configured yet" — matches the model's own column defaults.
    return (
      profile ?? {
        entityId,
        primaryColor: '#0F1B2D',
        secondaryColor: '#16273D',
        accentColor: '#C9A227',
        themeMode: 'SYSTEM',
        whiteLabelEnabled: false,
        language: 'en',
        supportedLanguages: ['en'],
        timeZone: 'Africa/Lagos',
        dateFormat: 'DD/MM/YYYY',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        currencySymbolPosition: 'BEFORE',
      }
    );
  }

  /** Merges the entity's branding defaults with one user's personal overrides. */
  async resolveBranding(entityId: string, userId?: string) {
    const [profile, preference] = await Promise.all([
      this.getBrandingProfile(entityId),
      userId ? this.prisma.userPreference.findUnique({ where: { userId } }) : Promise.resolve(null),
    ]);

    return {
      ...profile,
      themeMode: preference?.theme ?? profile.themeMode,
      language: preference?.language ?? profile.language,
      timeZone: preference?.timezone ?? profile.timeZone,
    };
  }

  // -------------------------------------------------------------------
  // BRAND ASSETS (logos, letterhead, watermark, stamp, signature)
  // -------------------------------------------------------------------

  async uploadBrandAsset(entityId: string, dto: UploadBrandAssetDto, file: UploadedFileLike, userId: string) {
    await this.assertEntityExists(entityId);

    const key = `branding/${entityId}/${dto.assetType.toLowerCase()}/${randomUUID()}-${file.originalname}`;
    const uploaded = await this.storage.upload({ key, buffer: file.buffer, contentType: file.mimetype });

    if (dto.isDefault) {
      // Only one default per (entity, assetType) — demote any existing default first.
      await this.prisma.brandAsset.updateMany({
        where: { entityId, assetType: dto.assetType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.brandAsset.create({
      data: {
        entityId,
        assetType: dto.assetType,
        label: dto.label,
        storageKey: uploaded.key,
        url: uploaded.url,
        isDefault: dto.isDefault ?? false,
        uploadedById: userId,
      },
    });
  }

  listBrandAssets(entityId: string, assetType?: BrandAssetType) {
    return this.prisma.brandAsset.findMany({ where: { entityId, assetType }, orderBy: { createdAt: 'desc' } });
  }

  async deleteBrandAsset(id: string) {
    const asset = await this.prisma.brandAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`Brand asset ${id} not found`);
    await this.storage.delete(asset.storageKey);
    return this.prisma.brandAsset.delete({ where: { id } });
  }

  // -------------------------------------------------------------------
  // DOCUMENT TEMPLATES (email, invoice, PO, receipt)
  // -------------------------------------------------------------------

  async upsertTemplate(dto: UpsertDocumentTemplateDto, userId: string) {
    await this.assertEntityExists(dto.entityId);

    const existing = await this.prisma.documentTemplate.findFirst({
      where: { entityId: dto.entityId, templateType: dto.templateType, code: dto.code },
    });

    if (existing) {
      return this.prisma.documentTemplate.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          subject: dto.subject,
          content: dto.content,
          isDefault: dto.isDefault ?? false,
        },
      });
    }

    return this.prisma.documentTemplate.create({
      data: {
        entityId: dto.entityId,
        templateType: dto.templateType,
        code: dto.code,
        name: dto.name,
        subject: dto.subject,
        content: dto.content,
        isDefault: dto.isDefault ?? false,
        createdById: userId,
      },
    });
  }

  listTemplates(filters: { entityId?: string; templateType?: DocumentTemplateType }) {
    return this.prisma.documentTemplate.findMany({
      where: { entityId: filters.entityId, templateType: filters.templateType, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Entity-specific template lookup. DocumentTemplate.entityId is a required,
   * NOT NULL foreign key to Entity (see prisma/schema.prisma), so there is no
   * system-wide "global default" (entityId = null) row to fall back to — every
   * template must belong to a real entity.
   */
  async resolveTemplate(entityId: string, templateType: DocumentTemplateType, code: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { entityId, templateType, code, isActive: true },
    });
    if (!template) throw new NotFoundException(`No ${templateType} template "${code}" found for this entity`);
    return template;
  }

  /** Resolves a template then substitutes {{key}} merge tags with `data`. */
  async renderTemplate(entityId: string, templateType: DocumentTemplateType, code: string, data: Record<string, string>) {
    const template = await this.resolveTemplate(entityId, templateType, code);
    const substitute = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
    return {
      subject: template.subject ? substitute(template.subject) : undefined,
      content: substitute(template.content),
    };
  }

  // -------------------------------------------------------------------
  // USER PREFERENCES
  // -------------------------------------------------------------------

  upsertUserPreference(userId: string, dto: UpsertUserPreferenceDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  getUserPreference(userId: string) {
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }

  // -------------------------------------------------------------------
  // TRANSLATIONS (minimal i18n store)
  // -------------------------------------------------------------------

  upsertTranslation(dto: UpsertTranslationDto) {
    return this.prisma.translationEntry.upsert({
      where: { locale_namespace_key: { locale: dto.locale, namespace: dto.namespace, key: dto.key } },
      create: dto,
      update: { value: dto.value },
    });
  }

  async getTranslations(locale: string, namespace?: string): Promise<Record<string, string>> {
    const entries = await this.prisma.translationEntry.findMany({ where: { locale, namespace } });
    return Object.fromEntries(entries.map((e: { namespace: string; key: string; value: string }) => [`${e.namespace}.${e.key}`, e.value]));
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async assertEntityExists(entityId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundException(`Entity ${entityId} not found`);
  }
}
