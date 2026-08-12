import { Module } from '@nestjs/common';
import { ContactsProviderRegistry } from './contacts-provider.registry';
import { MicrosoftGraphContactsProvider } from './providers/microsoft-graph-contacts.provider';
import { GoogleContactsProvider } from './providers/google-contacts.provider';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Release IG.1, Checkpoint E started with the registry only, same
 * minimal shape CalendarModule/BankIntegrationModule started with at
 * their own Checkpoint A.
 *
 * Release IG.1, Checkpoint F adds the first concrete provider —
 * MicrosoftGraphContactsProvider.
 *
 * Release IH (Google Workspace), Checkpoint D adds the second concrete
 * provider — GoogleContactsProvider — into the same registry.
 *
 * This checkpoint adds ContactsService/ContactsController — the same
 * gap CalendarService/CalendarController closed for Calendar. Same
 * scope decision: no Prisma persistence, and no opinion on which
 * existing contact-like record (Candidate/CrmLead/Vendor/...) should
 * sync as an Outlook/Google contact — see ContactsService's own doc
 * comment and contacts-provider.interface.ts's design notes for why
 * that's still a later checkpoint's decision, not this one's.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [ContactsProviderRegistry, MicrosoftGraphContactsProvider, GoogleContactsProvider, ContactsService],
  controllers: [ContactsController],
  exports: [ContactsProviderRegistry, ContactsService],
})
export class ContactsModule {}
