import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailTemplateService } from './email-template.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateEmailTemplateDto, RenderEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

/**
 * Reuses the existing 'admin.templates.manage'/'admin.templates.view'
 * permission codes (already governing DocumentTemplate in admin-branding)
 * rather than minting 'email_template.manage' — both are "manage the
 * templates used to produce outbound content", and the codes themselves
 * aren't document-specific.
 *
 * Deliberately NOT a general templating engine — `{{variable}}`
 * substitution only, HTML-escaped on the html field, not on subject/text
 * (see EmailTemplateService's own doc comment for why that's a
 * deliberate scope decision, not a gap). `render()`/`preview` throw
 * rather than silently send an email with a literal `{{placeholder}}`
 * left in it if the caller's variables map is missing anything the
 * template actually references.
 */
@ApiTags('notifications-email-templates')
@ApiBearerAuth()
@Controller('email-templates')
export class EmailTemplateController {
  constructor(private readonly emailTemplates: EmailTemplateService) {}

  @Post()
  @RequirePermissions('admin.templates.manage')
  @ApiOperation({ summary: 'Create an email template', description: 'code must be unique across every template.' })
  create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.emailTemplates.createTemplate(dto, user.id);
  }

  @Get()
  @RequirePermissions('admin.templates.view')
  @ApiOperation({ summary: 'List email templates', description: 'isActive is an optional filter; omitted, every template is returned regardless of active state.' })
  findAll(@Query('isActive') isActive?: string) {
    return this.emailTemplates.findTemplates(isActive === undefined ? {} : { isActive: isActive === 'true' });
  }

  @Get(':code')
  @RequirePermissions('admin.templates.view')
  @ApiOperation({ summary: 'Get a template by its own code' })
  getByCode(@Param('code') code: string) {
    return this.emailTemplates.getTemplateByCode(code);
  }

  @Patch(':id')
  @RequirePermissions('admin.templates.manage')
  @ApiOperation({ summary: 'Update a template', description: 'Every update bumps the template\'s own version by 1 — there is no separate history table, version is the only trace of prior edits.' })
  update(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplates.updateTemplate(id, dto);
  }

  /** Renders without creating a Notification or sending anything — for an admin to preview a template against sample data before it's used for real. */
  @Post(':code/preview')
  @RequirePermissions('admin.templates.view')
  @ApiOperation({
    summary: 'Render a template against sample data without sending anything',
    description: 'No Notification row is created and no email is sent — a pure render, for an admin to check a template before it\'s used for real. Rejected with a 400 listing every placeholder the template references that variables doesn\'t supply, and if the template is currently inactive.',
  })
  preview(@Param('code') code: string, @Body() dto: RenderEmailTemplateDto) {
    return this.emailTemplates.render(code, dto.variables);
  }
}
