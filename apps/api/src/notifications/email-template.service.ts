import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

export interface RenderedEmail {
  subject: string;
  html?: string;
  text: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every `{{variableName}}` placeholder actually referenced in a template string, deduplicated. */
function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

/** Escapes the five HTML-significant characters — enough to make a plain-string variable safe to drop into an HTML document, not a general sanitizer (variables are expected to be plain text like a name or an amount, never caller-supplied markup). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function substitute(template: string, variables: Record<string, string>, escape: boolean): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = variables[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });
}

/**
 * Release IC.4 — Email Template Engine.
 *
 * Deliberately NOT a general templating engine (no Handlebars/EJS/Mustache
 * dependency) — just `{{variable}}` substitution, with HTML-escaping on the
 * HTML path only (see escapeHtml's doc comment). See EmailTemplate's own
 * doc comment in schema.prisma for why that's the right amount of power
 * for this feature rather than a gap.
 *
 * Template *management* (create/update/list) lives here too rather than in
 * a separate service, mirroring how RiskRegisterService owns both its CRUD
 * and its scoring logic — render() isn't meaningfully separable from the
 * templates it renders.
 */
@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(dto: CreateEmailTemplateDto, createdById: string): Promise<EmailTemplate> {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`A template with code "${dto.code}" already exists`);

    return this.prisma.emailTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        subjectTemplate: dto.subjectTemplate,
        htmlTemplate: dto.htmlTemplate,
        textTemplate: dto.textTemplate,
        variables: (dto.variables ?? undefined) as never,
        createdById,
      },
    });
  }

  findTemplates(filters: { isActive?: boolean } = {}): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({ where: filters, orderBy: { code: 'asc' } });
  }

  async getTemplateByCode(code: string): Promise<EmailTemplate> {
    const template = await this.prisma.emailTemplate.findUnique({ where: { code } });
    if (!template) throw new NotFoundException(`Email template "${code}" not found`);
    return template;
  }

  private async requireTemplate(id: string): Promise<EmailTemplate> {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Email template ${id} not found`);
    return template;
  }

  /** Every update bumps `version` by 1 — see EmailTemplate.version's doc comment for why there's no separate history table. */
  async updateTemplate(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
    const template = await this.requireTemplate(id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        subjectTemplate: dto.subjectTemplate,
        htmlTemplate: dto.htmlTemplate,
        textTemplate: dto.textTemplate,
        variables: (dto.variables ?? undefined) as never,
        isActive: dto.isActive,
        version: template.version + 1,
      },
    });
  }

  /**
   * Renders subject/html/text for one template against a variables map.
   * Throws BadRequestException listing every placeholder the template
   * references that `variables` doesn't supply, rather than silently
   * sending an email with literal "{{firstName}}" left in it.
   */
  async render(code: string, variables: Record<string, string>): Promise<RenderedEmail> {
    const template = await this.getTemplateByCode(code);
    if (!template.isActive) {
      throw new BadRequestException(`Email template "${code}" is inactive`);
    }

    const required = new Set([
      ...extractPlaceholders(template.subjectTemplate),
      ...extractPlaceholders(template.textTemplate),
      ...(template.htmlTemplate ? extractPlaceholders(template.htmlTemplate) : []),
    ]);
    const missing = [...required].filter((key) => !(key in variables));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Email template "${code}" is missing required variable(s): ${missing.join(', ')}`,
      );
    }

    return {
      subject: substitute(template.subjectTemplate, variables, false),
      html: template.htmlTemplate ? substitute(template.htmlTemplate, variables, true) : undefined,
      text: substitute(template.textTemplate, variables, false),
    };
  }
}
