import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankProviderRegistry } from './bank-provider.registry';
import { ValidateBankAccountDto } from './dto/validate-bank-account.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Release IF.2, Checkpoint B — Account Validation API endpoint.
 *
 * Checkpoint A (paystack-bank.provider.ts) implemented
 * PaystackBankProvider.validateAccount() for real, but audited this
 * checkpoint found it was never actually reachable: no controller, no
 * service, nothing in this codebase called
 * `BankProviderRegistry.get(...).validateAccount(...)` anywhere outside
 * the provider/interface/module files themselves. This controller is
 * that missing caller — a thin pass-through to the registry, not a new
 * calculation or a parallel validation mechanism.
 *
 * Deliberately its own controller rather than added to
 * MonoLinkedAccountController: that controller is specifically about
 * Mono Connect linking (bank_link.manage-gated mutations tied to a
 * BankAccount); this is a stateless, provider-agnostic lookup with no
 * linked-account concept involved for its default (PAYSTACK) case. Uses
 * the existing `bank_link.view` permission rather than adding a new one
 * — validating an account number is the same class of lightweight,
 * read-only bank-account action `bank_link.view` already gates for the
 * linked-accounts list.
 */
@ApiTags('bank-integration')
@ApiBearerAuth()
@Controller('bank-integration')
export class BankAccountValidationController {
  constructor(private readonly bankProviders: BankProviderRegistry) {}

  @Post('validate-account')
  @ApiOperation({
    summary: 'Validate a bank account number/code pair via the given (or default PAYSTACK) provider',
    description:
      'Stateless and provider-agnostic -- deliberately separate from MonoLinkedAccountController, which is specifically about Mono Connect linking; this has no linked-account concept involved. Gated on bank_link.view, the same lightweight read-only permission the linked-accounts list already uses, rather than a new permission.',
  })
  @RequirePermissions('bank_link.view')
  async validateAccount(@Body() dto: ValidateBankAccountDto) {
    const provider = this.bankProviders.get(dto.providerCode ?? 'PAYSTACK');
    return provider.validateAccount({ accountNumber: dto.accountNumber, bankCode: dto.bankCode });
  }
}
