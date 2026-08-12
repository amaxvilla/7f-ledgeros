import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmailTemplateService } from '../email-template.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    emailTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [EmailTemplateService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EmailTemplateService);
  });

  describe('createTemplate', () => {
    it('rejects a duplicate code', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createTemplate(
          { code: 'WELCOME_EMAIL', name: 'Welcome', subjectTemplate: 'Hi', textTemplate: 'Hi' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.emailTemplate.create).not.toHaveBeenCalled();
    });

    it('creates a new template when the code is free', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue(null);
      prisma.emailTemplate.create.mockResolvedValue({ id: 'et1', code: 'WELCOME_EMAIL' });

      const result = await service.createTemplate(
        { code: 'WELCOME_EMAIL', name: 'Welcome', subjectTemplate: 'Hi {{firstName}}', textTemplate: 'Welcome, {{firstName}}!' },
        'user-1',
      );

      expect(prisma.emailTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'WELCOME_EMAIL', createdById: 'user-1' }) }),
      );
      expect(result).toEqual({ id: 'et1', code: 'WELCOME_EMAIL' });
    });
  });

  describe('updateTemplate', () => {
    it('increments version on every update', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue({ id: 'et1', version: 2 });
      prisma.emailTemplate.update.mockResolvedValue({ id: 'et1', version: 3 });

      await service.updateTemplate('et1', { name: 'New name' });

      expect(prisma.emailTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'et1' }, data: expect.objectContaining({ version: 3 }) }),
      );
    });

    it('throws NotFoundException for an unknown template id', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue(null);
      await expect(service.updateTemplate('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('render', () => {
    const template = {
      id: 'et1',
      code: 'WELCOME_EMAIL',
      isActive: true,
      subjectTemplate: 'Welcome, {{firstName}}!',
      textTemplate: 'Hi {{firstName}}, your account {{accountCode}} is ready.',
      htmlTemplate: '<p>Hi {{firstName}}, your account {{accountCode}} is ready.</p>',
    };

    it('substitutes every {{variable}} in subject/text/html', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue(template);

      const result = await service.render('WELCOME_EMAIL', { firstName: 'Ada', accountCode: 'ACC-1' });

      expect(result).toEqual({
        subject: 'Welcome, Ada!',
        text: 'Hi Ada, your account ACC-1 is ready.',
        html: '<p>Hi Ada, your account ACC-1 is ready.</p>',
      });
    });

    it('HTML-escapes variables substituted into the html template but not the text template', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue({
        ...template,
        textTemplate: 'Company: {{companyName}}',
        htmlTemplate: '<p>Company: {{companyName}}</p>',
        subjectTemplate: 'Hi',
      });

      const result = await service.render('WELCOME_EMAIL', { firstName: 'Ada', accountCode: 'x', companyName: 'A & B <Ltd>' });

      expect(result.text).toBe('Company: A & B <Ltd>');
      expect(result.html).toBe('<p>Company: A &amp; B &lt;Ltd&gt;</p>');
    });

    it('omits html entirely when the template has no htmlTemplate', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue({ ...template, htmlTemplate: null });

      const result = await service.render('WELCOME_EMAIL', { firstName: 'Ada', accountCode: 'ACC-1' });

      expect(result.html).toBeUndefined();
    });

    it('throws BadRequestException listing every missing variable', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue(template);

      await expect(service.render('WELCOME_EMAIL', {})).rejects.toThrow(BadRequestException);
      await expect(service.render('WELCOME_EMAIL', {})).rejects.toThrow(/firstName/);
      await expect(service.render('WELCOME_EMAIL', {})).rejects.toThrow(/accountCode/);
    });

    it('throws BadRequestException for an inactive template', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue({ ...template, isActive: false });
      await expect(service.render('WELCOME_EMAIL', { firstName: 'Ada', accountCode: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown template code', async () => {
      prisma.emailTemplate.findUnique.mockResolvedValue(null);
      await expect(service.render('NOPE', {})).rejects.toThrow(NotFoundException);
    });
  });
});
