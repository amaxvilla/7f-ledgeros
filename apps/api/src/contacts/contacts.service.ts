import { Injectable } from '@nestjs/common';
import { ContactsProviderRegistry } from './contacts-provider.registry';
import { CreateContactDto, UpdateContactDto, DeleteContactDto } from './dto/contact.dto';

/**
 * The piece ContactsProviderRegistry and MicrosoftGraphContactsProvider/
 * GoogleContactsProvider were missing: something that actually calls
 * createContact/updateContact/deleteContact. Mirrors CalendarService
 * exactly, including its scope decision: no Prisma persistence, and no
 * opinion on which of this codebase's contact-like records
 * (Candidate/CrmLead/Vendor/...) should sync as an Outlook/Google
 * contact — contacts-provider.interface.ts's own design notes explicitly
 * defer that decision to whichever future caller needs it. This layer
 * only makes create/update/delete callable at all; a later checkpoint
 * can build e.g. "sync this CRM lead to Outlook" on top of it, the same
 * relationship a hypothetical "auto-create a calendar event for a site
 * visit" caller would have to CalendarService.
 */
@Injectable()
export class ContactsService {
  constructor(private readonly registry: ContactsProviderRegistry) {}

  createContact(dto: CreateContactDto) {
    const { providerCode, ...params } = dto;
    return this.registry.get(providerCode).createContact(params);
  }

  updateContact(providerContactId: string, dto: UpdateContactDto) {
    const { providerCode, ...params } = dto;
    return this.registry.get(providerCode).updateContact({ ...params, providerContactId });
  }

  deleteContact(providerContactId: string, dto: DeleteContactDto) {
    return this.registry.get(dto.providerCode).deleteContact({ providerContactId });
  }
}
