import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateContactDto, UpdateContactDto, DeleteContactDto } from './dto/contact.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a contact via the given contacts provider',
    description: 'A thin call-through to the provider registry -- no Prisma persistence, no opinion on which of this codebase\'s own leads/contacts should sync to a provider address book.',
  })
  @RequirePermissions('contacts.manage')
  create(@Body() dto: CreateContactDto) {
    return this.contacts.createContact(dto);
  }

  @Post(':providerContactId')
  @ApiOperation({ summary: 'Update a contact via the given contacts provider' })
  @RequirePermissions('contacts.manage')
  update(@Param('providerContactId') providerContactId: string, @Body() dto: UpdateContactDto) {
    return this.contacts.updateContact(providerContactId, dto);
  }

  @Delete(':providerContactId')
  @ApiOperation({ summary: 'Delete a contact via the given contacts provider' })
  @RequirePermissions('contacts.manage')
  remove(@Param('providerContactId') providerContactId: string, @Body() dto: DeleteContactDto) {
    return this.contacts.deleteContact(providerContactId, dto);
  }
}
